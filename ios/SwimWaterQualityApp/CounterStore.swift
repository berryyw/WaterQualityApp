import CoreLocation
import Foundation
import MapKit
import SwiftUI

@MainActor
final class SwimAppStore: NSObject, ObservableObject {
    @Published var isRestoringSession = true
    @Published var currentUser: AppUser?
    @Published var cameraPosition: MapCameraPosition
    @Published var mapDisplayMode: MapDisplayMode {
        didSet { UserDefaults.standard.set(mapDisplayMode.rawValue, forKey: mapModeKey) }
    }
    @Published var currentCity: SupportedCity {
        didSet {
            UserDefaults.standard.set(currentCity.rawValue, forKey: currentCityKey)
            cameraPosition = .region(CityRegionCatalog.regions[currentCity] ?? defaultRegion)

            if venueCollections[currentCity] == nil {
                Task {
                    try? await loadVenues(for: currentCity)
                }
            }
        }
    }
    @Published var notificationPermissionDenied = false
    @Published var locationPermissionDenied = false
    @Published private(set) var userLocation: CLLocation?
    @Published private(set) var locationAuthorizationStatus: CLAuthorizationStatus
    @Published private(set) var allCities: [SupportedCity]

    private let appService: AppServicing
    private let locationManager = CLLocationManager()
    private let currentCityKey = "swim_quality.current_city"
    private let mapModeKey = "swim_quality.map_mode"
    private var shouldCenterOnUserAfterAuthorization = false
    private var venueCollections: [SupportedCity: [SwimVenue]] = [:]
    private var reviewsByVenueID: [String: [VenueReview]] = [:]
    private var firstLoginVerificationToken: String?
    private var changeEmailVerificationToken: String?
    private var changePasswordVerificationToken: String?
    @Published private(set) var autoSwitchCityBasedOnUserLocation: Bool = false
    private var hasResolvedDefaultCity = false
    private var hasManualCitySelection = false

    private var defaultRegion: MKCoordinateRegion {
        CityRegionCatalog.regions[.losAngeles] ?? MKCoordinateRegion()
    }

    init(appService: AppServicing = RemoteAppService()) {
        let savedCityCode = UserDefaults.standard.string(forKey: currentCityKey) ?? ""
        // 本地 LA 兜底 region（inline，避免 super.init 前用 self.defaultRegion）
        let laFallbackRegion = CityRegionCatalog.regions[.losAngeles]
            ?? MKCoordinateRegion(
                center: CLLocationCoordinate2D(latitude: 34.0522, longitude: -118.2437),
                span: MKCoordinateSpan(latitudeDelta: 0.85, longitudeDelta: 0.85)
            )
        // 关键：即使 UserDefaults 为空，默认先用 LA 启动，不让 Beijing 污染 first paint
        let savedCity: SupportedCity
        if savedCityCode.isEmpty {
            savedCity = .losAngeles
            hasManualCitySelection = true
            hasResolvedDefaultCity = true
        } else {
            // SupportedCity(rawValue:) 返回非 optional；所以用 allCases 过滤，不在列表 → 退回 LA
            let temp = SupportedCity(rawValue: savedCityCode)
            if SupportedCity.allCases.contains(where: { $0.rawValue == temp.rawValue }) {
                savedCity = temp
            } else {
                savedCity = .losAngeles
            }
            hasManualCitySelection = true
            hasResolvedDefaultCity = true
        }
        self.appService = appService
        self.currentCity = savedCity
        self.mapDisplayMode = MapDisplayMode(
            rawValue: UserDefaults.standard.string(forKey: mapModeKey) ?? ""
        ) ?? .standard
        self.cameraPosition = .region(CityRegionCatalog.regions[savedCity] ?? laFallbackRegion)
        self.locationAuthorizationStatus = locationManager.authorizationStatus
        self.allCities = Array(NSOrderedSet(array: SupportedCity.allCases)) as! [SupportedCity]
        super.init()

        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyHundredMeters

        Task {
            await restoreSession()
        }
    }

    var isAuthenticated: Bool {
        currentUser != nil
    }

    var currentUserDisplayName: String {
        currentUser?.nickname ?? "泳者"
    }

    var cityVenues: [SwimVenue] {
        venueCollections[currentCity] ?? []
    }

    var trendingVenues: [SwimVenue] {
        cityVenues.sorted { lhs, rhs in
            let lhsCount = followerCount(for: lhs)
            let rhsCount = followerCount(for: rhs)
            if lhsCount != rhsCount {
                return lhsCount > rhsCount
            }
            if lhs.waterQuality.grade.rank != rhs.waterQuality.grade.rank {
                return lhs.waterQuality.grade.rank < rhs.waterQuality.grade.rank
            }
            return lhs.name < rhs.name
        }
    }

    var newArrivalVenues: [SwimVenue] {
        let cutoff = Calendar.current.date(byAdding: .month, value: -3, to: Date()) ?? .distantPast

        return cityVenues
            .filter { $0.openedAt >= cutoff }
            .sorted { lhs, rhs in
                if lhs.openedAt != rhs.openedAt {
                    return lhs.openedAt > rhs.openedAt
                }

                return followerCount(for: lhs) > followerCount(for: rhs)
            }
    }

    var excellentVenues: [SwimVenue] {
        trendingVenues.filter { $0.waterQuality.grade == .excellent }
    }

    var fastestRisingVenues: [SwimVenue] {
        cityVenues.sorted { lhs, rhs in
            if lhs.rankingMomentum != rhs.rankingMomentum {
                return lhs.rankingMomentum > rhs.rankingMomentum
            }

            return followerCount(for: lhs) > followerCount(for: rhs)
        }
    }

    var followingVenues: [SwimVenue] {
        guard let currentUser else { return [] }
        let followedSet = Set(currentUser.followedVenueIDs)

        return venueCollections.values
            .flatMap { $0 }
            .filter { followedSet.contains($0.id) }
            .sorted { lhs, rhs in
                if lhs.city != rhs.city {
                    return lhs.city.title < rhs.city.title
                }
                return followerCount(for: lhs) > followerCount(for: rhs)
            }
    }

    func venue(for venueID: String) -> SwimVenue? {
        venueCollections.values
            .flatMap { $0 }
            .first(where: { $0.id == venueID })
    }

    func reviews(for venue: SwimVenue) -> [VenueReview] {
        reviewsByVenueID[venue.id] ?? venue.reviews
    }

    func restoreSession() async {
        // 首屏加速：如果本地根本没有 session 存根（AppServicing 把 session 存在 UserDefaults["swim_quality.remote.session"]）
        // → 不发 /app/me 网络请求，直接 currentUser=nil，只 prefetch currentCity(默认 LA) venues
        let kRemoteSession = "swim_quality.remote.session"
        let hasStoredSession = UserDefaults.standard.data(forKey: kRemoteSession) != nil
        do {
            if hasStoredSession {
                let maybeUser = try await appService.restoreAuthenticatedUser()
                currentUser = maybeUser
                if maybeUser != nil {
                    try await refreshRemoteBootstrapForSessionRestore()
                } else {
                    // 有 session 但是过期/失效，至少把 currentCity 的 venues 拉一次
                    if venueCollections[currentCity] == nil {
                        try? await loadVenues(for: currentCity)
                    }
                }
            } else {
                currentUser = nil
                // 未登录：首屏不 prefetch 全部 allCities venues，只拉 currentCity（默认 LA）加速
                if venueCollections[currentCity] == nil {
                    try? await loadVenues(for: currentCity)
                }
            }
        } catch {
            currentUser = nil
            reviewsByVenueID = [:]
            // 出错：保留 venueCollections LA 缓存，不清空（首屏要显示 Marker）
        }

        isRestoringSession = false
    }

    func filteredVenues(searchText: String = "") -> [SwimVenue] {
        let keyword = searchText.trimmingCharacters(in: .whitespacesAndNewlines)

        let filtered = cityVenues.filter { venue in
            guard !keyword.isEmpty else { return true }
            return venue.name.localizedCaseInsensitiveContains(keyword)
                || venue.address.localizedCaseInsensitiveContains(keyword)
                || venue.district.localizedCaseInsensitiveContains(keyword)
        }

        return filtered.sorted { lhs, rhs in
            if let lhsDistance = distanceFromUser(to: lhs), let rhsDistance = distanceFromUser(to: rhs), lhsDistance != rhsDistance {
                return lhsDistance < rhsDistance
            }

            if lhs.waterQuality.grade.rank != rhs.waterQuality.grade.rank {
                return lhs.waterQuality.grade.rank < rhs.waterQuality.grade.rank
            }

            return followerCount(for: lhs) > followerCount(for: rhs)
        }
    }

    func isFollowed(_ venueID: String) -> Bool {
        currentUser?.followedVenueIDs.contains(venueID) == true
    }

    func followerCount(for venue: SwimVenue) -> Int {
        self.venue(for: venue.id)?.followersCount ?? venue.followersCount
    }

    func distanceFromUser(to venue: SwimVenue) -> CLLocationDistance? {
        guard let userLocation else { return nil }
        let venueLocation = CLLocation(latitude: venue.latitude, longitude: venue.longitude)
        return userLocation.distance(from: venueLocation)
    }

    func distanceText(for venue: SwimVenue) -> String? {
        guard let distance = distanceFromUser(to: venue) else { return nil }
        if distance < 1000 {
            return "\(Int(distance)) m"
        }
        return String(format: "%.1f km", distance / 1000)
    }

    func centerOnVenue(_ venue: SwimVenue) {
        cameraPosition = .region(
            MKCoordinateRegion(
                center: venue.coordinate,
                span: MKCoordinateSpan(latitudeDelta: 0.03, longitudeDelta: 0.03)
            )
        )
    }

    func switchCity(to city: SupportedCity) {
        guard currentCity != city else { return }
        hasManualCitySelection = true
        hasResolvedDefaultCity = true
        currentCity = city
    }

    func syncMapCurrentCityToUserLocation() {
        // 开关保护：默认不允许「定位后自动切城市」，防止把默认 LA 覆盖成 Beijing/Shanghai
        guard autoSwitchCityBasedOnUserLocation else { return }
        guard let userLocation else { return }

        let locatedCity = nearestKnownCity(to: userLocation.coordinate)
        guard let matchedCity = allCities.first(where: { $0 == locatedCity }) else {
            return
        }

        if currentCity != matchedCity {
            currentCity = matchedCity
        }
    }

    func applyDefaultCurrentCitySelection() {
        guard !hasManualCitySelection else { return }

        let fallbackCity = preferredFallbackCity()

        guard let userLocation else {
            if currentCity != fallbackCity {
                currentCity = fallbackCity
            }
            return
        }

        let locatedCity = nearestKnownCity(to: userLocation.coordinate)
        let resolvedCity = allCities.first(where: { $0 == locatedCity }) ?? fallbackCity

        guard currentCity != resolvedCity || !hasResolvedDefaultCity else { return }
        currentCity = resolvedCity
        hasResolvedDefaultCity = true
    }

    func requestCurrentLocation(focusMap: Bool = true) {
        shouldCenterOnUserAfterAuthorization = focusMap
        let status = locationManager.authorizationStatus
        locationAuthorizationStatus = status

        switch status {
        case .authorizedAlways, .authorizedWhenInUse:
            locationManager.requestLocation()
        case .notDetermined:
            locationManager.requestWhenInUseAuthorization()
        case .denied, .restricted:
            locationPermissionDenied = true
        @unknown default:
            break
        }
    }

    func dismissLocationPermissionAlert() {
        locationPermissionDenied = false
    }

    func dismissNotificationPermissionAlert() {
        notificationPermissionDenied = false
    }

    private func nearestKnownCity(to coordinate: CLLocationCoordinate2D) -> SupportedCity {
        let location = CLLocation(latitude: coordinate.latitude, longitude: coordinate.longitude)

        return Array(CityRegionCatalog.regions.keys).min { lhs, rhs in
            let lhsCenter = CityRegionCatalog.regions[lhs]?.center ?? defaultRegion.center
            let rhsCenter = CityRegionCatalog.regions[rhs]?.center ?? defaultRegion.center

            let lhsDistance = location.distance(from: CLLocation(latitude: lhsCenter.latitude, longitude: lhsCenter.longitude))
            let rhsDistance = location.distance(from: CLLocation(latitude: rhsCenter.latitude, longitude: rhsCenter.longitude))
            return lhsDistance < rhsDistance
        } ?? .losAngeles
    }

    private func preferredFallbackCity() -> SupportedCity {
        // 硬编码返回洛杉矶：不依赖 allCities 排序 / 后端返回
        return .losAngeles
    }

    func sendFirstLoginCode(to email: String) async throws {
        try await appService.sendVerificationCode(to: email, purpose: .firstLogin)
        Haptics.success()
    }

    func verifyFirstLoginCode(email: String, code: String) async throws {
        firstLoginVerificationToken = try await appService.verifyCode(
            email: email,
            code: code,
            purpose: .firstLogin
        )
        Haptics.success()
    }

    func completeFirstLogin(email: String, password: String) async throws {
        guard let firstLoginVerificationToken else {
            throw AuthServiceError.verificationRequired
        }

        currentUser = try await appService.finishFirstLogin(
            email: email,
            password: password,
            verificationToken: firstLoginVerificationToken
        )
        self.firstLoginVerificationToken = nil
        try await refreshRemoteBootstrap()
        Haptics.success()
    }

    func login(email: String, password: String) async throws {
        currentUser = try await appService.login(email: email, password: password)
        try await refreshRemoteBootstrap()
        Haptics.success()
    }

    func signOut() async {
        await appService.signOut()
        currentUser = nil
        venueCollections = [:]
        reviewsByVenueID = [:]
        firstLoginVerificationToken = nil
        changeEmailVerificationToken = nil
        changePasswordVerificationToken = nil
    }

    func toggleFollow(for venue: SwimVenue) async throws {
        guard currentUser != nil else { throw AuthServiceError.notAuthenticated }

        currentUser = try await appService.toggleFollow(
            venueID: venue.id,
            isCurrentlyFollowed: isFollowed(venue.id)
        )
        try await loadVenues(for: venue.city)
        Haptics.tap()
    }

    func updateNickname(_ nickname: String) async throws {
        guard currentUser != nil else { throw AuthServiceError.notAuthenticated }
        self.currentUser = try await appService.updateNickname(nickname)
        Haptics.success()
    }

    func updateAvatar(data: Data?) async throws {
        guard currentUser != nil else { throw AuthServiceError.notAuthenticated }
        self.currentUser = try await appService.updateAvatar(data)
        Haptics.success()
    }

    func sendChangeEmailCode(to newEmail: String) async throws {
        try await appService.sendVerificationCode(to: newEmail, purpose: .changeEmail)
        Haptics.success()
    }

    func confirmChangeEmail(to newEmail: String, code: String) async throws {
        changeEmailVerificationToken = try await appService.verifyCode(
            email: newEmail,
            code: code,
            purpose: .changeEmail
        )

        guard let changeEmailVerificationToken else {
            throw AuthServiceError.verificationRequired
        }

        self.currentUser = try await appService.updateEmail(
            to: newEmail,
            verificationToken: changeEmailVerificationToken
        )
        self.changeEmailVerificationToken = nil
        Haptics.success()
    }

    func sendChangePasswordCode() async throws {
        guard let currentUser else { throw AuthServiceError.notAuthenticated }
        try await appService.sendVerificationCode(to: currentUser.email, purpose: .changePassword)
        Haptics.success()
    }

    func verifyChangePasswordCode(_ code: String) async throws {
        guard let currentUser else { throw AuthServiceError.notAuthenticated }
        changePasswordVerificationToken = try await appService.verifyCode(
            email: currentUser.email,
            code: code,
            purpose: .changePassword
        )
        Haptics.success()
    }

    func confirmChangePassword(code: String, newPassword: String) async throws {
        guard currentUser != nil else { throw AuthServiceError.notAuthenticated }
        guard let changePasswordVerificationToken else {
            throw AuthServiceError.verificationRequired
        }

        _ = code
        try await appService.updatePassword(
            verificationToken: changePasswordVerificationToken,
            newPassword: newPassword
        )
        self.changePasswordVerificationToken = nil
        Haptics.success()
    }

    func loadReviews(for venueID: String) async throws {
        reviewsByVenueID[venueID] = try await appService.listReviews(venueID: venueID)
    }

    func submitReview(for venue: SwimVenue, content: String) async throws {
        guard currentUser != nil else { throw AuthServiceError.notAuthenticated }

        let trimmed = content.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { throw VenueReviewError.emptyContent }
        guard trimmed.count <= 200 else { throw VenueReviewError.contentTooLong }

        let createdReview = try await appService.submitReview(
            venueID: venue.id,
            content: trimmed
        )

        var venueReviews = reviewsByVenueID[venue.id] ?? []
        venueReviews.insert(createdReview, at: 0)
        reviewsByVenueID[venue.id] = venueReviews
        Haptics.success()
    }

    private func refreshRemoteBootstrap() async throws {
        let availableCities = try await appService.listEnabledCities()
        // 关键：后端 enabled cities ∪ 本地 SupportedCity.allCases —— 保证 LA 永远在 allCities 里（即使后端忘插 la 行）
        let merged = NSMutableOrderedSet()
        for c in availableCities { if c.rawValue.isEmpty == false { merged.add(c) } }
        for c in SupportedCity.allCases { if c.rawValue.isEmpty == false { merged.add(c) } }
        allCities = merged.array as! [SupportedCity]

        if hasManualCitySelection, let matchedCurrentCity = allCities.first(where: { $0 == currentCity }) {
            // 手动/默认已选的城市只要在 allCities 里就保留，不被 bootstrap 覆盖
            currentCity = matchedCurrentCity
        } else if hasManualCitySelection {
            // 用户手动选过但 allCities 没有，退回 fallback LA
            currentCity = preferredFallbackCity()
        } else {
            applyDefaultCurrentCitySelection()
        }

        try await withThrowingTaskGroup(of: (SupportedCity, [SwimVenue]).self) { group in
            for city in allCities {
                group.addTask {
                    let venues = try await self.appService.listVenues(city: city)
                    return (city, venues)
                }
            }

            var refreshedCollections: [SupportedCity: [SwimVenue]] = [:]
            for try await (city, venues) in group {
                refreshedCollections[city] = venues
            }

            venueCollections = refreshedCollections
        }
    }

    private func refreshRemoteBootstrapForSessionRestore() async throws {
        let availableCities = try await appService.listEnabledCities()
        // 关键：同上，后端 + 本地硬合并，保证 LA 在
        let merged = NSMutableOrderedSet()
        for c in availableCities { if c.rawValue.isEmpty == false { merged.add(c) } }
        for c in SupportedCity.allCases { if c.rawValue.isEmpty == false { merged.add(c) } }
        allCities = merged.array as! [SupportedCity]

        if hasManualCitySelection, let matchedCurrentCity = allCities.first(where: { $0 == currentCity }) {
            currentCity = matchedCurrentCity
        } else if hasManualCitySelection {
            currentCity = preferredFallbackCity()
        } else {
            applyDefaultCurrentCitySelection()
        }

        let prioritizedCity = currentCity
        venueCollections[prioritizedCity] = try await appService.listVenues(city: prioritizedCity)

        let remainingCities = allCities.filter { $0 != prioritizedCity }
        guard !remainingCities.isEmpty else { return }

        Task {
            try? await self.prefetchRemainingVenues(for: remainingCities)
        }
    }

    private func prefetchRemainingVenues(for cities: [SupportedCity]) async throws {
        try await withThrowingTaskGroup(of: (SupportedCity, [SwimVenue]).self) { group in
            for city in cities {
                group.addTask {
                    let venues = try await self.appService.listVenues(city: city)
                    return (city, venues)
                }
            }

            for try await (city, venues) in group {
                self.venueCollections[city] = venues
            }
        }
    }

    private func loadVenues(for city: SupportedCity) async throws {
        let venues = try await appService.listVenues(city: city)
        venueCollections[city] = venues
    }
}

enum VenueReviewError: LocalizedError {
    case emptyContent
    case contentTooLong

    var errorDescription: String? {
        switch self {
        case .emptyContent:
            return "请输入评价内容后再提交。"
        case .contentTooLong:
            return "评价内容需控制在 200 字以内。"
        }
    }
}

extension SwimAppStore: CLLocationManagerDelegate {
    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        Task { @MainActor in
            self.locationAuthorizationStatus = manager.authorizationStatus

            switch manager.authorizationStatus {
            case .authorizedAlways, .authorizedWhenInUse:
                if self.shouldCenterOnUserAfterAuthorization || self.userLocation == nil {
                    manager.requestLocation()
                }
            case .denied, .restricted:
                self.locationPermissionDenied = true
            case .notDetermined:
                break
            @unknown default:
                break
            }
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let latestLocation = locations.last else { return }

        Task { @MainActor in
            self.userLocation = latestLocation
            self.syncMapCurrentCityToUserLocation()

            if self.shouldCenterOnUserAfterAuthorization {
                self.cameraPosition = .region(
                    MKCoordinateRegion(
                        center: latestLocation.coordinate,
                        span: MKCoordinateSpan(latitudeDelta: 0.04, longitudeDelta: 0.04)
                    )
                )
                self.shouldCenterOnUserAfterAuthorization = false
            }
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        Task { @MainActor in
            self.shouldCenterOnUserAfterAuthorization = false
            print("locationManager error: \(error.localizedDescription)")
        }
    }
}

protocol AppServicing {
    func restoreAuthenticatedUser() async throws -> AppUser?
    func sendVerificationCode(to email: String, purpose: VerificationPurpose) async throws
    func verifyCode(email: String, code: String, purpose: VerificationPurpose) async throws -> String
    func finishFirstLogin(email: String, password: String, verificationToken: String) async throws -> AppUser
    func login(email: String, password: String) async throws -> AppUser
    func updateNickname(_ nickname: String) async throws -> AppUser
    func updateAvatar(_ data: Data?) async throws -> AppUser
    func updateEmail(to newEmail: String, verificationToken: String) async throws -> AppUser
    func updatePassword(verificationToken: String, newPassword: String) async throws
    func toggleFollow(venueID: String, isCurrentlyFollowed: Bool) async throws -> AppUser
    func listEnabledCities() async throws -> [SupportedCity]
    func listVenues(city: SupportedCity) async throws -> [SwimVenue]
    func listReviews(venueID: String) async throws -> [VenueReview]
    func submitReview(venueID: String, content: String) async throws -> VenueReview
    func signOut() async
}

enum AuthServiceError: LocalizedError {
    case invalidEmail
    case invalidPasswordFormat
    case accountAlreadyExists
    case accountNotFound
    case passwordLoginRequired
    case invalidPassword
    case verificationNotFound
    case verificationExpired
    case verificationCodeMismatch
    case verificationRequired
    case notAuthenticated

    var errorDescription: String? {
        switch self {
        case .invalidEmail:
            return "请输入有效的邮箱地址。"
        case .invalidPasswordFormat:
            return "密码需为 8-20 位，且至少包含字母和数字。"
        case .accountAlreadyExists:
            return "该邮箱已经存在，请直接使用密码登录。"
        case .accountNotFound:
            return "未找到对应账号，请先完成首次登录注册。"
        case .passwordLoginRequired:
            return "该邮箱已设置密码，请直接使用密码登录。"
        case .invalidPassword:
            return "邮箱或密码错误。"
        case .verificationNotFound:
            return "请先发送验证码。"
        case .verificationExpired:
            return "验证码已过期，请重新发送。"
        case .verificationCodeMismatch:
            return "验证码不正确，请重新输入。"
        case .verificationRequired:
            return "请先完成验证码校验后再继续。"
        case .notAuthenticated:
            return "当前未登录，请重新登录后再试。"
        }
    }
}

private struct StoredAppSession: Codable {
    var accessToken: String
    var refreshToken: String
}

private struct RefreshTokenRequest: Encodable {
    var refreshToken: String
}

private struct RefreshTokenResponse: Decodable {
    var accessToken: String
    var refreshToken: String
}

private enum RemoteServiceError: LocalizedError {
    case invalidResponse
    case http(statusCode: Int, message: String)
    case decodingFailed
    case transport(String)

    var errorDescription: String? {
        switch self {
        case .invalidResponse:
            return "服务响应异常，请稍后再试。"
        case let .http(_, message):
            return message
        case .decodingFailed:
            return "数据解析失败，请检查本地服务是否为最新版本。"
        case let .transport(message):
            return message
        }
    }
}

private final class RemoteAppService: AppServicing {
    private let session = URLSession.shared
    private let storage = UserDefaults.standard
    private let sessionKey = "swim_quality.remote.session"
    private let baseURL: URL
    private let jsonDecoder: JSONDecoder
    private let jsonEncoder: JSONEncoder

    init(baseURL: URL = AppServiceConfiguration.resolveBaseURL()) {
        self.baseURL = baseURL

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let string = try container.decode(String.self)
            if let date = Self.iso8601WithFractional.date(from: string) ?? Self.iso8601.date(from: string) {
                return date
            }
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Invalid ISO8601 date: \(string)")
        }
        self.jsonDecoder = decoder

        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        self.jsonEncoder = encoder
    }

    func restoreAuthenticatedUser() async throws -> AppUser? {
        guard let storedSession = loadSession() else { return nil }

        do {
            let me: BackendMeResponse = try await request(
                path: "/app/me",
                method: "GET",
                token: storedSession.accessToken,
                body: Optional<String>.none
            )
            return makeUser(from: me)
        } catch let RemoteServiceError.http(statusCode, _) where statusCode == 401 {
            do {
                let refreshedSession = try await refreshSession(using: storedSession.refreshToken)
                let me: BackendMeResponse = try await request(
                    path: "/app/me",
                    method: "GET",
                    token: refreshedSession.accessToken,
                    body: Optional<String>.none
                )
                return makeUser(from: me)
            } catch {
                clearSession()
                return nil
            }
        }
    }

    func sendVerificationCode(to email: String, purpose: VerificationPurpose) async throws {
        let _: SendCodeResponse = try await request(
            path: "/app/auth/send-code",
            method: "POST",
            token: nil,
            body: SendCodeRequest(email: email, purpose: purpose.apiValue)
        )
    }

    func verifyCode(email: String, code: String, purpose: VerificationPurpose) async throws -> String {
        let response: VerifyCodeResponse = try await request(
            path: "/app/auth/verify-code",
            method: "POST",
            token: nil,
            body: VerifyCodeRequest(email: email, purpose: purpose.apiValue, code: code)
        )
        return response.verificationToken
    }

    func finishFirstLogin(email: String, password: String, verificationToken: String) async throws -> AppUser {
        let response: AppAuthSuccessResponse = try await request(
            path: "/app/auth/register",
            method: "POST",
            token: nil,
            body: RegisterRequest(
                email: email,
                password: password,
                nickname: nil,
                verificationToken: verificationToken
            )
        )
        saveSession(
            StoredAppSession(
                accessToken: response.accessToken,
                refreshToken: response.refreshToken
            )
        )
        return makeUser(from: response.user)
    }

    func login(email: String, password: String) async throws -> AppUser {
        let response: AppAuthSuccessResponse = try await request(
            path: "/app/auth/login",
            method: "POST",
            token: nil,
            body: LoginRequest(email: email, password: password)
        )
        saveSession(
            StoredAppSession(
                accessToken: response.accessToken,
                refreshToken: response.refreshToken
            )
        )
        return makeUser(from: response.user)
    }

    func updateNickname(_ nickname: String) async throws -> AppUser {
        let session = try requireSession()
        let response: BackendMeResponse = try await request(
            path: "/app/me/profile",
            method: "PATCH",
            token: session.accessToken,
            body: UpdateProfileRequest(nickname: nickname)
        )
        return makeUser(from: response)
    }

    func updateAvatar(_ data: Data?) async throws -> AppUser {
        let session = try requireSession()
        guard let data else {
            let me: BackendMeResponse = try await request(
                path: "/app/me",
                method: "GET",
                token: session.accessToken,
                body: Optional<EmptyPayload>.none
            )
            return makeUser(from: me)
        }

        let response: BackendMeResponse = try await upload(
            path: "/app/me/avatar",
            token: session.accessToken,
            fileName: "avatar.jpg",
            mimeType: "image/jpeg",
            data: data
        )
        return makeUser(from: response)
    }

    func updateEmail(to newEmail: String, verificationToken: String) async throws -> AppUser {
        let session = try requireSession()
        let response: BackendMeResponse = try await request(
            path: "/app/me/email",
            method: "POST",
            token: session.accessToken,
            body: ChangeEmailRequest(newEmail: newEmail, verificationToken: verificationToken)
        )
        return makeUser(from: response)
    }

    func updatePassword(verificationToken: String, newPassword: String) async throws {
        let session = try requireSession()
        let _: SuccessResponse = try await request(
            path: "/app/me/password",
            method: "POST",
            token: session.accessToken,
            body: ChangePasswordRequest(newPassword: newPassword, verificationToken: verificationToken)
        )
        clearSession()
    }

    func toggleFollow(venueID: String, isCurrentlyFollowed: Bool) async throws -> AppUser {
        let session = try requireSession()
        let _: EmptyPayload = try await request(
            path: "/app/venues/\(venueID)/follow",
            method: isCurrentlyFollowed ? "DELETE" : "POST",
            token: session.accessToken,
            body: Optional<EmptyPayload>.none
        )

        let me: BackendMeResponse = try await request(
            path: "/app/me",
            method: "GET",
            token: session.accessToken,
            body: Optional<EmptyPayload>.none
        )
        return makeUser(from: me)
    }

    func listEnabledCities() async throws -> [SupportedCity] {
        let response: [BackendCityResponse] = try await request(
            path: "/app/cities",
            method: "GET",
            token: nil,
            body: Optional<EmptyPayload>.none
        )
        return response.compactMap { city in
            guard city.status == "enabled" else { return nil }
            return SupportedCity(
                rawValue: city.code,
                title: city.name,
                subtitle: city.code.uppercased()
            )
        }
    }

    func listVenues(city: SupportedCity) async throws -> [SwimVenue] {
        let response: [BackendVenueResponse] = try await request(
            path: "/app/venues?cityCode=\(city.rawValue)",
            method: "GET",
            token: nil,
            body: Optional<EmptyPayload>.none
        )
        return response.compactMap(Self.makeVenue)
    }

    func listReviews(venueID: String) async throws -> [VenueReview] {
        let response: [BackendReviewResponse] = try await request(
            path: "/app/venues/\(venueID)/reviews",
            method: "GET",
            token: nil,
            body: Optional<EmptyPayload>.none
        )
        return response.map(Self.makeReview)
    }

    func submitReview(venueID: String, content: String) async throws -> VenueReview {
        let session = try requireSession()
        let response: BackendReviewResponse = try await request(
            path: "/app/venues/\(venueID)/reviews",
            method: "POST",
            token: session.accessToken,
            body: CreateReviewRequest(content: content)
        )
        return Self.makeReview(from: response)
    }

    func signOut() async {
        clearSession()
    }

    private func loadSession() -> StoredAppSession? {
        guard let data = storage.data(forKey: sessionKey) else { return nil }
        return try? jsonDecoder.decode(StoredAppSession.self, from: data)
    }

    private func saveSession(_ session: StoredAppSession) {
        if let data = try? jsonEncoder.encode(session) {
            storage.set(data, forKey: sessionKey)
        }
    }

    private func clearSession() {
        storage.removeObject(forKey: sessionKey)
    }

    private func requireSession() throws -> StoredAppSession {
        guard let session = loadSession() else {
            throw AuthServiceError.notAuthenticated
        }
        return session
    }

    private func refreshSession(using refreshToken: String) async throws -> StoredAppSession {
        let response: RefreshTokenResponse = try await request(
            path: "/app/auth/refresh",
            method: "POST",
            token: nil,
            body: RefreshTokenRequest(refreshToken: refreshToken)
        )
        let refreshedSession = StoredAppSession(
            accessToken: response.accessToken,
            refreshToken: response.refreshToken
        )
        saveSession(refreshedSession)
        return refreshedSession
    }

    private func request<Response: Decodable, Body: Encodable>(
        path: String,
        method: String,
        token: String?,
        body: Body?
    ) async throws -> Response {
        let normalizedPath = path.hasPrefix("/") ? String(path.dropFirst()) : path

        guard let url = URL(string: normalizedPath, relativeTo: baseURL) else {
            throw RemoteServiceError.invalidResponse
        }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        if let body {
            request.httpBody = try jsonEncoder.encode(body)
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            if let urlError = error as? URLError {
                switch urlError.code {
                case .cannotConnectToHost, .networkConnectionLost, .notConnectedToInternet, .timedOut:
                    throw RemoteServiceError.transport("当前无法连接本地服务，请确认 SwimService 已启动，且地址为 \(baseURL.host() ?? baseURL.absoluteString):\(baseURL.port ?? 80)。")
                default:
                    throw RemoteServiceError.transport("网络请求失败：\(urlError.localizedDescription)")
                }
            }
            throw RemoteServiceError.transport("网络请求失败：\(error.localizedDescription)")
        }
        guard let httpResponse = response as? HTTPURLResponse else {
            throw RemoteServiceError.invalidResponse
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            if let apiError = try? jsonDecoder.decode(APIErrorPayload.self, from: data) {
                throw RemoteServiceError.http(statusCode: httpResponse.statusCode, message: apiError.message)
            }
            throw RemoteServiceError.http(statusCode: httpResponse.statusCode, message: "请求失败，请稍后再试。")
        }

        if Response.self == EmptyPayload.self {
            return EmptyPayload() as! Response
        }

        do {
            return try jsonDecoder.decode(Response.self, from: data)
        } catch {
            throw RemoteServiceError.decodingFailed
        }
    }

    private func upload<Response: Decodable>(
        path: String,
        token: String,
        fileName: String,
        mimeType: String,
        data: Data
    ) async throws -> Response {
        let normalizedPath = path.hasPrefix("/") ? String(path.dropFirst()) : path

        guard let url = URL(string: normalizedPath, relativeTo: baseURL) else {
            throw RemoteServiceError.invalidResponse
        }

        let boundary = "Boundary-\(UUID().uuidString)"
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        request.httpBody = makeMultipartBody(
            boundary: boundary,
            fieldName: "file",
            fileName: fileName,
            mimeType: mimeType,
            data: data
        )

        let (responseData, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw RemoteServiceError.invalidResponse
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            if let apiError = try? jsonDecoder.decode(APIErrorPayload.self, from: responseData) {
                throw RemoteServiceError.http(statusCode: httpResponse.statusCode, message: apiError.message)
            }
            throw RemoteServiceError.http(statusCode: httpResponse.statusCode, message: "请求失败，请稍后再试。")
        }

        do {
            return try jsonDecoder.decode(Response.self, from: responseData)
        } catch {
            throw RemoteServiceError.decodingFailed
        }
    }

    private func makeMultipartBody(
        boundary: String,
        fieldName: String,
        fileName: String,
        mimeType: String,
        data: Data
    ) -> Data {
        var body = Data()
        let lineBreak = "\r\n"

        body.append(Data("--\(boundary)\(lineBreak)".utf8))
        body.append(Data("Content-Disposition: form-data; name=\"\(fieldName)\"; filename=\"\(fileName)\"\(lineBreak)".utf8))
        body.append(Data("Content-Type: \(mimeType)\(lineBreak)\(lineBreak)".utf8))
        body.append(data)
        body.append(Data("\(lineBreak)--\(boundary)--\(lineBreak)".utf8))

        return body
    }

    private func makeUser(from response: BackendUserPayload) -> AppUser {
        let avatarResource = resolveAvatarReference(response.avatarUrl)
        return AppUser(
            email: response.email,
            nickname: response.nickname,
            avatarData: avatarResource.data,
            avatarURL: avatarResource.url?.absoluteString,
            followedVenueIDs: response.followedVenueIds ?? []
        )
    }

    private func makeUser(from response: BackendMeResponse) -> AppUser {
        let avatarResource = resolveAvatarReference(response.avatarUrl)
        return AppUser(
            email: response.email,
            nickname: response.nickname,
            avatarData: avatarResource.data,
            avatarURL: avatarResource.url?.absoluteString,
            followedVenueIDs: response.followedVenueIds
        )
    }

    private static func makeVenue(from response: BackendVenueResponse) -> SwimVenue? {
        let city = SupportedCity(
            rawValue: response.city.code,
            title: response.city.name,
            subtitle: response.city.code.uppercased()
        )

        let report = response.waterQuality.first.map(makeWaterQualityReport)
            ?? WaterQualityReport(
                grade: .attention,
                note: "暂无最新水质报告",
                updatedAt: response.updatedAt,
                turbidity: 0,
                waterTemperature: 0,
                potentialHydrogenValue: 0,
                freeChlorine: 0,
                combinedChlorine: 0,
                orp: 0,
                bacterialCount: "暂无",
                totalColiforms: "暂无",
                urea: 0,
                cyanuricAcid: 0,
                tds: 0
            )

        return SwimVenue(
            id: response.id,
            city: city,
            name: response.name,
            district: response.district,
            address: response.address,
            latitude: response.latitude,
            longitude: response.longitude,
            coverStyle: artworkStyle(for: response.id),
            summary: response.summary ?? "查看本地真实水质与场馆动态",
            imageCaption: response.imageCaption ?? response.name,
            followersCount: response.followersCount,
            openedAt: response.openedAt ?? response.createdAt,
            rankingMomentum: response.rankingMomentum,
            waterQuality: report,
            reviews: []
        )
    }

    private static func makeWaterQualityReport(from response: BackendWaterQualityResponse) -> WaterQualityReport {
        WaterQualityReport(
            grade: PoolQualityGrade(rawValue: response.grade) ?? .good,
            note: response.note,
            updatedAt: response.updatedAt,
            turbidity: response.turbidity,
            waterTemperature: response.waterTemperature,
            potentialHydrogenValue: response.phValue,
            freeChlorine: response.freeChlorine,
            combinedChlorine: response.combinedChlorine,
            orp: response.orp,
            bacterialCount: response.bacterialCount,
            totalColiforms: response.totalColiforms,
            urea: response.urea,
            cyanuricAcid: response.cyanuricAcid,
            tds: response.tds
        )
    }

    private static func makeReview(from response: BackendReviewResponse) -> VenueReview {
        let displayName = response.user.profile?.nickname ?? response.user.email
        return VenueReview(
            id: response.id,
            userName: displayName,
            userAvatarSymbol: avatarSymbol(for: displayName),
            userAvatarHex: avatarHex(for: displayName),
            content: response.content,
            createdAt: response.createdAt
        )
    }

    private func resolveAvatarReference(_ value: String?) -> (data: Data?, url: URL?) {
        guard let value, !value.isEmpty else {
            return (nil, nil)
        }

        if value.hasPrefix("data:") {
            return (Self.dataFromDataURL(value), nil)
        }

        guard let rawURL = URL(string: value, relativeTo: baseURL)?.absoluteURL else {
            return (nil, nil)
        }

        return (nil, rewriteLoopbackURLIfNeeded(rawURL))
    }

    private func rewriteLoopbackURLIfNeeded(_ url: URL) -> URL {
        guard let host = url.host?.lowercased() else {
            return url
        }

        guard host == "localhost" || host == "127.0.0.1" else {
            return url
        }

        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              let serviceComponents = URLComponents(url: baseURL, resolvingAgainstBaseURL: false),
              let serviceHost = serviceComponents.host,
              !serviceHost.isEmpty
        else {
            return url
        }

        var rewritten = components
        rewritten.scheme = serviceComponents.scheme
        rewritten.host = serviceHost
        rewritten.port = serviceComponents.port

        return rewritten.url ?? url
    }

    private static func dataFromDataURL(_ value: String?) -> Data? {
        guard let value else { return nil }
        let parts = value.split(separator: ",", maxSplits: 1).map(String.init)
        let base64Part = parts.count == 2 ? parts[1] : parts.first ?? ""
        return Data(base64Encoded: base64Part)
    }

    private static func avatarSymbol(for seed: String) -> String {
        let symbols = [
            "person.fill",
            "sparkles",
            "figure.pool.swim",
            "heart.fill",
            "drop.fill",
            "sun.max.fill",
        ]
        let index = abs(seed.hashValue) % symbols.count
        return symbols[index]
    }

    private static func avatarHex(for seed: String) -> String {
        let colors = [
            "#0A84FF",
            "#30B0C7",
            "#5856D6",
            "#34C759",
            "#FF9F0A",
            "#AF52DE",
        ]
        let index = abs(seed.hashValue) % colors.count
        return colors[index]
    }

    private static func artworkStyle(for seed: String) -> VenueArtworkStyle {
        let palette = [
            VenueArtworkStyle(symbolName: "figure.pool.swim", topColorHex: "#0A84FF", bottomColorHex: "#6CD8FF", accentColorHex: "#DDF6FF"),
            VenueArtworkStyle(symbolName: "water.waves", topColorHex: "#1463FF", bottomColorHex: "#67D7FF", accentColorHex: "#F2FBFF"),
            VenueArtworkStyle(symbolName: "drop.fill", topColorHex: "#0F6CBD", bottomColorHex: "#58C3FF", accentColorHex: "#F0FAFF"),
            VenueArtworkStyle(symbolName: "sparkles", topColorHex: "#2563EB", bottomColorHex: "#7DD3FC", accentColorHex: "#F1F9FF"),
        ]
        return palette[abs(seed.hashValue) % palette.count]
    }

    private static let iso8601: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    private static let iso8601WithFractional: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()
}

private enum AppServiceConfiguration {
    static let infoPlistKey = "SWIM_SERVICE_BASE_URL"
    static let deviceDebugBaseURL = "http://47.253.51.32:3000/api/"
    static let simulatorBaseURL = "http://47.253.51.32:3000/api/"

    static func resolveBaseURL() -> URL {
        if let configured = Bundle.main.object(forInfoDictionaryKey: infoPlistKey) as? String,
           let url = URL(string: configured),
           !configured.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return url
        }

        #if targetEnvironment(simulator)
        return URL(string: simulatorBaseURL)!
        #else
        return URL(string: deviceDebugBaseURL)!
        #endif
    }
}

private extension VerificationPurpose {
    var apiValue: String {
        switch self {
        case .firstLogin:
            return "register"
        case .changeEmail:
            return "change_email"
        case .changePassword:
            return "change_password"
        }
    }
}

private struct EmptyPayload: Codable {}

private struct APIErrorPayload: Decodable {
    var message: String

    private enum CodingKeys: String, CodingKey {
        case message
        case error
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)

        if let message = try? container.decode(String.self, forKey: .message) {
            self.message = message
            return
        }

        if let messages = try? container.decode([String].self, forKey: .message),
           let firstMessage = messages.first,
           !firstMessage.isEmpty {
            self.message = firstMessage
            return
        }

        if let error = try? container.decode(String.self, forKey: .error),
           !error.isEmpty {
            self.message = error
            return
        }

        self.message = "请求失败，请稍后再试。"
    }
}

private struct SendCodeRequest: Encodable {
    var email: String
    var purpose: String
}

private struct SendCodeResponse: Decodable {
    var success: Bool
    var message: String
    var expiresInSeconds: Int
}

private struct VerifyCodeRequest: Encodable {
    var email: String
    var purpose: String
    var code: String
}

private struct VerifyCodeResponse: Decodable {
    var verificationToken: String
    var expiresInSeconds: Int
}

private struct RegisterRequest: Encodable {
    var email: String
    var password: String
    var nickname: String?
    var verificationToken: String
}

private struct LoginRequest: Encodable {
    var email: String
    var password: String
}

private struct UpdateProfileRequest: Encodable {
    var nickname: String?
}

private struct ChangeEmailRequest: Encodable {
    var newEmail: String
    var verificationToken: String
}

private struct ChangePasswordRequest: Encodable {
    var newPassword: String
    var verificationToken: String
}

private struct CreateReviewRequest: Encodable {
    var content: String
}

private struct SuccessResponse: Decodable {
    var success: Bool
}

private struct AppAuthSuccessResponse: Decodable {
    var accessToken: String
    var refreshToken: String
    var user: BackendUserPayload
}

private struct BackendUserPayload: Decodable {
    var id: String
    var email: String
    var nickname: String
    var avatarUrl: String?
    var status: String
    var followedVenueIds: [String]?
}

private struct BackendMeResponse: Decodable {
    var id: String
    var email: String
    var nickname: String
    var avatarUrl: String?
    var status: String
    var followedVenueIds: [String]
}

private struct BackendCityResponse: Decodable {
    var id: String
    var code: String
    var name: String
    var status: String
}

private struct BackendVenueCityResponse: Decodable {
    var code: String
    var name: String
}

private struct BackendWaterQualityResponse: Decodable {
    var grade: String
    var note: String
    var updatedAt: Date
    var turbidity: Double
    var waterTemperature: Double
    var phValue: Double
    var freeChlorine: Double
    var combinedChlorine: Double
    var orp: Int
    var bacterialCount: String
    var totalColiforms: String
    var urea: Double
    var cyanuricAcid: Double
    var tds: Int

    private enum CodingKeys: String, CodingKey {
        case grade
        case note
        case updatedAt
        case turbidity
        case waterTemperature
        case phValue
        case freeChlorine
        case combinedChlorine
        case orp
        case bacterialCount
        case totalColiforms
        case urea
        case cyanuricAcid
        case tds
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        grade = try container.decode(String.self, forKey: .grade)
        note = try container.decode(String.self, forKey: .note)
        updatedAt = try container.decode(Date.self, forKey: .updatedAt)
        turbidity = try container.decodeFlexibleDouble(forKey: .turbidity)
        waterTemperature = try container.decodeFlexibleDouble(forKey: .waterTemperature)
        phValue = try container.decodeFlexibleDouble(forKey: .phValue)
        freeChlorine = try container.decodeFlexibleDouble(forKey: .freeChlorine)
        combinedChlorine = try container.decodeFlexibleDouble(forKey: .combinedChlorine)
        orp = try container.decodeFlexibleInt(forKey: .orp)
        bacterialCount = try container.decode(String.self, forKey: .bacterialCount)
        totalColiforms = try container.decode(String.self, forKey: .totalColiforms)
        urea = try container.decodeFlexibleDouble(forKey: .urea)
        cyanuricAcid = try container.decodeFlexibleDouble(forKey: .cyanuricAcid)
        tds = try container.decodeFlexibleInt(forKey: .tds)
    }
}

private struct BackendVenueResponse: Decodable {
    var id: String
    var name: String
    var district: String
    var address: String
    var latitude: Double
    var longitude: Double
    var summary: String?
    var imageCaption: String?
    var followersCount: Int
    var rankingMomentum: Int
    var openedAt: Date?
    var createdAt: Date
    var updatedAt: Date
    var city: BackendVenueCityResponse
    var waterQuality: [BackendWaterQualityResponse]

    private enum CodingKeys: String, CodingKey {
        case id
        case name
        case district
        case address
        case latitude
        case longitude
        case summary
        case imageCaption
        case followersCount
        case rankingMomentum
        case openedAt
        case createdAt
        case updatedAt
        case city
        case waterQuality
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        name = try container.decode(String.self, forKey: .name)
        district = try container.decode(String.self, forKey: .district)
        address = try container.decode(String.self, forKey: .address)
        latitude = try container.decodeFlexibleDouble(forKey: .latitude)
        longitude = try container.decodeFlexibleDouble(forKey: .longitude)
        summary = try container.decodeIfPresent(String.self, forKey: .summary)
        imageCaption = try container.decodeIfPresent(String.self, forKey: .imageCaption)
        followersCount = try container.decodeFlexibleInt(forKey: .followersCount)
        rankingMomentum = try container.decodeFlexibleInt(forKey: .rankingMomentum)
        openedAt = try container.decodeIfPresent(Date.self, forKey: .openedAt)
        createdAt = try container.decode(Date.self, forKey: .createdAt)
        updatedAt = try container.decode(Date.self, forKey: .updatedAt)
        city = try container.decode(BackendVenueCityResponse.self, forKey: .city)
        waterQuality = try container.decode(
            [BackendWaterQualityResponse].self,
            forKey: .waterQuality
        )
    }
}

private struct BackendReviewUserProfileResponse: Decodable {
    var nickname: String?
}

private struct BackendReviewUserResponse: Decodable {
    var email: String
    var profile: BackendReviewUserProfileResponse?
}

private struct BackendReviewResponse: Decodable {
    var id: String
    var content: String
    var createdAt: Date
    var user: BackendReviewUserResponse
}

private extension KeyedDecodingContainer {
    func decodeFlexibleDouble(forKey key: Key) throws -> Double {
        if let value = try? decode(Double.self, forKey: key) {
            return value
        }

        if let value = try? decode(String.self, forKey: key),
           let parsed = Double(value) {
            return parsed
        }

        throw DecodingError.dataCorruptedError(
            forKey: key,
            in: self,
            debugDescription: "Expected a Double-compatible value."
        )
    }

    func decodeFlexibleInt(forKey key: Key) throws -> Int {
        if let value = try? decode(Int.self, forKey: key) {
            return value
        }

        if let value = try? decode(String.self, forKey: key),
           let parsed = Int(value) {
            return parsed
        }

        throw DecodingError.dataCorruptedError(
            forKey: key,
            in: self,
            debugDescription: "Expected an Int-compatible value."
        )
    }
}
