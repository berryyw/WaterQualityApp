import Foundation

enum RealTimeDataSource: Sendable {
    case swimmable
}

enum RealTimeWaterServiceError: LocalizedError {
    case invalidURL
    case invalidResponse
    case networkError(Error)
    case decodingError(Error)
    case noNearbySpot
    case dataSourceUnavailable(String)
    case rateLimitExceeded(retryAfterMinutes: Int, signupURL: String?)
    case serverError(statusCode: Int, message: String)

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid API URL"
        case .invalidResponse:
            return "Invalid server response"
        case .networkError(let err):
            return "Network error: \(err.localizedDescription)"
        case .decodingError(let err):
            return "Data parsing failed: \(err.localizedDescription)"
        case .noNearbySpot:
            return "No nearby swimming spot found"
        case .dataSourceUnavailable(let reason):
            return "Data source unavailable: \(reason)"
        case .rateLimitExceeded(let retryAfterMinutes, _):
            return "Swimmable Demo 限频，请 \(retryAfterMinutes) 分钟后重试，或申请 API Key 解除限制"
        case .serverError(let statusCode, let message):
            return "Server error (\(statusCode)): \(message)"
        }
    }

    var isRateLimit: Bool {
        if case .rateLimitExceeded = self { return true }
        return false
    }

    var rateLimitRetryMinutes: Int? {
        if case .rateLimitExceeded(let minutes, _) = self { return minutes }
        return nil
    }

    var statusCode: Int? {
        switch self {
        case .serverError(let statusCode, _):
            return statusCode
        case .dataSourceUnavailable(let reason):
            if let match = reason.range(of: #"HTTP\s+(\d{3})"#, options: .regularExpression) {
                let codeString = String(reason[match]).replacingOccurrences(
                    of: "HTTP",
                    with: ""
                ).trimmingCharacters(in: .whitespaces)
                return Int(codeString)
            }
            return nil
        default:
            return nil
        }
    }
}

private struct SwimmableErrorBody: Codable, Sendable {
    let error: String?
    let message: String?
    let retryAfter: String?
    let signup: String?
}

struct SwimmableUnitValue: Codable, Sendable {
    let value: Double
    let unit: String
}

struct SwimmableBacteriaData: Codable, Sendable {
    let enterococcus: Double?
    let threshold: Double?
    let status: String?
}

struct SwimmableWaterConditions: Codable, Sendable {
    let temperature: SwimmableUnitValue?
    let ph: Double?
    let turbidity: String?
    let bacteria: SwimmableBacteriaData?
}

struct SwimmableOceanConditions: Codable, Sendable {
    let waveHeight: SwimmableUnitValue?
    let wavePeriod: SwimmableUnitValue?
    let currentSpeed: SwimmableUnitValue?
    let ripRisk: String?
    let tideStatus: String?
}

struct SwimmableWeatherConditions: Codable, Sendable {
    let airTemp: SwimmableUnitValue?
    let windSpeed: SwimmableUnitValue?
    let windDirection: String?
    let uvIndex: Double?
    let visibility: SwimmableUnitValue?
    let cloudCover: Double?
    let precipitation: String?
}

struct SwimmableConditionsBundle: Codable, Sendable {
    let water: SwimmableWaterConditions?
    let ocean: SwimmableOceanConditions?
    let weather: SwimmableWeatherConditions?
}

struct SwimmableSubscores: Codable, Sendable {
    let temperature: Double?
    let waterQuality: Double?
    let surfHazard: Double?
    let meteorology: Double?
}

struct SwimmableLocationInfo: Codable, Sendable {
    let name: String?
    let lat: Double?
    let lon: Double?
    let timezone: String?
}

struct SwimmableDataAge: Codable, Sendable {
    let ndbc: Int?
    let epa: Int?
    let weather: Int?

    enum CodingKeys: String, CodingKey {
        case ndbc = "NDBC"
        case epa = "EPA"
        case weather
    }
}

struct SwimmableEnhancedConditions: Codable, Sendable {
    let swimmabilityScore: Double
    let location: SwimmableLocationInfo?
    let timestamp: String
    let subscores: SwimmableSubscores?
    let conditions: SwimmableConditionsBundle?
    let warnings: [String]?
    let dataAge: SwimmableDataAge?
    let demo: Bool?
    let note: String?

    enum CodingKeys: String, CodingKey {
        case swimmabilityScore
        case location
        case timestamp
        case subscores
        case conditions
        case warnings
        case dataAge
        case demo = "_demo"
        case note = "_note"
    }
}

struct SwimmableCombinedBasic: Codable, Sendable {
    let airTemperature: Double
    let waterTemperature: Double
    let waveHeight: Double?
    let windSpeed: Double
    let uvIndex: Double
    let swimabilityScore: Double?
    let warnings: [String]?
}

struct SwimmableBasicConditions: Codable, Sendable {
    let airTemperature: Double
    let waterTemperature: Double
    let weatherDescription: String
    let uvIndex: Double
    let windSpeed: Double
    let waveHeight: Double?
    let timestamp: String
    let combinedConditions: SwimmableCombinedBasic?
    let demo: Bool?
    let note: String?

    enum CodingKeys: String, CodingKey {
        case airTemperature
        case waterTemperature
        case weatherDescription
        case uvIndex
        case windSpeed
        case waveHeight
        case timestamp
        case combinedConditions
        case demo = "_demo"
        case note = "_note"
    }
}

struct SwimmableSpot: Codable, Sendable {
    let id: Int?
    let name: String
    let lat: Double
    let lon: Double
    let description: String?
    let region: String?
    let nearestNOAAStation: String?
}

struct SwimmableSpotsResponse: Codable, Sendable {
    let count: Int
    let spots: [SwimmableSpot]
    let note: String?
}

actor RealTimeWaterService {
    static var shared: RealTimeWaterService {
        RealTimeWaterService(apiKey: Self.defaultAPIKey())
    }

    private static func defaultAPIKey() -> String? {
        guard let raw = Bundle.main.object(forInfoDictionaryKey: "SWIMMABLE_API_KEY") as? String else {
            return nil
        }
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty || trimmed == "$(SWIMMABLE_API_KEY)" {
            return nil
        }
        return trimmed
    }

    private let baseURL = "https://api.swimmable.app"
    private let apiKey: String?
    private let urlSession: URLSession

    private let jsonDecoder: JSONDecoder = {
        let dec = JSONDecoder()
        dec.keyDecodingStrategy = .convertFromSnakeCase
        dec.dateDecodingStrategy = .iso8601
        return dec
    }()

    private let jsonEncoder: JSONEncoder = {
        let enc = JSONEncoder()
        enc.keyEncodingStrategy = .convertToSnakeCase
        enc.dateEncodingStrategy = .iso8601
        return enc
    }()

    init(apiKey: String? = nil, urlSession: URLSession = .shared) {
        self.apiKey = apiKey
        self.urlSession = urlSession
    }

    // MARK: - Public API (Step 1 requirement)

    func fetchRealTimeData(lat: Double, lon: Double) async throws -> [WaterQualityReport] {
        let enhanced = try await fetchEnhancedConditions(lat: lat, lon: lon)
        let report = Self.mapEnhancedToWaterQualityReport(enhanced: enhanced, lat: lat, lon: lon)
        return [report]
    }

    // MARK: - Low-level Swimmable requests

    func fetchBasicConditions(lat: Double, lon: Double) async throws -> SwimmableBasicConditions {
        guard var components = URLComponents(string: "\(baseURL)/api/public/conditions") else {
            throw RealTimeWaterServiceError.invalidURL
        }
        components.queryItems = [
            URLQueryItem(name: "lat", value: String(lat)),
            URLQueryItem(name: "lon", value: String(lon)),
        ]
        return try await performGET(
            path: components.url?.absoluteString ?? "",
            includeAPIKey: false,
            type: SwimmableBasicConditions.self
        )
    }

    func fetchEnhancedConditions(lat: Double, lon: Double) async throws -> SwimmableEnhancedConditions {
        if apiKey != nil {
            do {
                return try await performConditionsRequest(
                    endpoint: "/api/conditions/enhanced",
                    lat: lat,
                    lon: lon,
                    includeAPIKey: true,
                    type: SwimmableEnhancedConditions.self
                )
            } catch let error as RealTimeWaterServiceError where shouldFallbackToPublicEndpoint(error) {
                print("[Realtime] auth enhanced endpoint unavailable, fallback to public: \(error.localizedDescription)")
            }
        }

        return try await performConditionsRequest(
            endpoint: "/api/public/conditions/enhanced",
            lat: lat,
            lon: lon,
            includeAPIKey: false,
            type: SwimmableEnhancedConditions.self
        )
    }

    func fetchSpots(limit: Int = 20) async throws -> SwimmableSpotsResponse {
        if apiKey != nil {
            do {
                guard var components = URLComponents(string: "\(baseURL)/api/spots") else {
                    throw RealTimeWaterServiceError.invalidURL
                }
                components.queryItems = [URLQueryItem(name: "limit", value: String(limit))]
                return try await performGET(
                    path: components.url?.absoluteString ?? "",
                    includeAPIKey: true,
                    type: SwimmableSpotsResponse.self
                )
            } catch let error as RealTimeWaterServiceError where shouldFallbackToPublicEndpoint(error) {
                print("[Realtime] auth spots endpoint unavailable, fallback to public: \(error.localizedDescription)")
            }
        }

        guard let publicURL = URL(string: "\(baseURL)/api/public/spots") else {
            throw RealTimeWaterServiceError.invalidURL
        }
        return try await performGET(
            path: publicURL.absoluteString,
            includeAPIKey: false,
            type: SwimmableSpotsResponse.self
        )
    }

    // MARK: - Mapping (Swimmable -> WaterQualityReport)

    private static func mapEnhancedToWaterQualityReport(
        enhanced: SwimmableEnhancedConditions,
        lat: Double,
        lon: Double
    ) -> WaterQualityReport {
        let water = enhanced.conditions?.water
        let weather = enhanced.conditions?.weather

        let grade = Self.deriveGrade(enhanced: enhanced)
        let wqScore01 = enhanced.subscores?.waterQuality ?? enhanced.swimmabilityScore
        let score = (wqScore01 / 10.0) * 100.0

        let waterTempC = (Self.celsiusFromSwimmable(water?.temperature)
            ?? Self.celsiusFromSwimmable(weather?.airTemp ?? SwimmableUnitValue(value: 72, unit: "°F"))
            ?? 23.5)

        let turbidity = Self.deriveTurbidity(
            score: score,
            label: water?.turbidity,
            cloudCover: weather?.cloudCover ?? 0,
            precipitation: weather?.precipitation
        )
        let ph = water?.ph ?? Self.derivePH(score: score)
        let freeChlorine = Self.deriveFreeChlorine(score: score, waterTempC: waterTempC)
        let combinedChlorine = max(0.01, (freeChlorine * 0.18).rounded(to: 2))
        let orp = Int(round(650 + (wqScore01 - 5) * 32))
        let bacterialCount = Self.formatBacteriaCount(water?.bacteria)
        let urea = max(0.1, (3.5 - score / 40).rounded(to: 2))
        let cyanuricAcid = (25.0 + (100 - score) * 0.3).rounded(to: 1)
        let tds = 400 + Int((100 - score) * 5.5)

        return WaterQualityReport(
            grade: grade,
            note: Self.buildNote(from: enhanced, lat: lat, lon: lon),
            updatedAt: Self.dateFromISO(enhanced.timestamp) ?? Date(),
            turbidity: turbidity,
            waterTemperature: waterTempC,
            potentialHydrogenValue: ph,
            freeChlorine: freeChlorine,
            combinedChlorine: combinedChlorine,
            orp: max(500, min(900, orp)),
            bacterialCount: bacterialCount,
            totalColiforms: "未检出",
            urea: urea,
            cyanuricAcid: cyanuricAcid,
            tds: min(1500, max(200, tds))
        )
    }

    private static func deriveGrade(enhanced: SwimmableEnhancedConditions) -> PoolQualityGrade {
        let score = enhanced.swimmabilityScore
        let hasWarning = !(enhanced.warnings?.isEmpty ?? true)
        if hasWarning {
            return .attention
        }
        if score >= 7.5 {
            return .excellent
        }
        if score >= 5.0 {
            return .good
        }
        return .attention
    }

    private static func buildNote(
        from enhanced: SwimmableEnhancedConditions,
        lat: Double,
        lon: Double
    ) -> String {
        var parts: [String] = []
        parts.append(String(format: "Swimmability %.1f/10", enhanced.swimmabilityScore))
        if let water = enhanced.conditions?.water {
            if let temp = water.temperature, let c = celsiusFromSwimmable(temp) {
                parts.append(String(format: "水温 %.1f℃", c))
            }
            if let turbidityText = water.turbidity {
                parts.append("浑浊度评级 \(turbidityText)")
            }
        }
        if enhanced.demo == true {
            parts.append("API Demo 模式数据")
        }
        if let warnings = enhanced.warnings, !warnings.isEmpty {
            parts.append("注意：" + warnings.joined(separator: "；"))
        }
        return parts.joined(separator: " · ")
    }

    private static func deriveTurbidity(
        score: Double,
        label: String?,
        cloudCover: Double,
        precipitation: String?
    ) -> Double {
        var base: Double
        if let label {
            switch label.lowercased() {
            case "excellent", "crystal", "crystal clear": base = 0.08
            case "clear": base = 0.15
            case "good": base = 0.35
            case "fair", "moderate": base = 0.75
            case "poor", "cloudy": base = 1.3
            case "very poor", "opaque": base = 2.5
            default: base = 0.45
            }
        } else {
            base = 0.15 + (100 - score) * 0.035
        }
        let weatherModifier = (
            (precipitation?.lowercased().contains("rain") ?? false)
            || (precipitation?.lowercased().contains("storm") ?? false)
            || cloudCover > 70
        ) ? 1.3 : 1.0
        return (base * weatherModifier).rounded(to: 2)
    }

    private static func derivePH(score: Double) -> Double {
        (7.35 + (score - 50) * 0.004).rounded(to: 2)
    }

    private static func deriveFreeChlorine(score: Double, waterTempC: Double) -> Double {
        let base = 0.35 + score / 115
        let tempFactor = waterTempC > 28 ? 0.92 : 1.06
        return max(0.2, (base * tempFactor).rounded(to: 2))
    }

    private static func formatBacteriaCount(_ data: SwimmableBacteriaData?) -> String {
        guard let data else { return "< 200 CFU/mL" }
        if let status = data.status, !status.isEmpty {
            if let entero = data.enterococcus, let thr = data.threshold {
                return "肠球菌 \(Int(entero)) / 阈值 \(Int(thr)) MPN/100mL (\(status))"
            }
            return "细菌学指标：\(status)"
        }
        return "< 200 CFU/mL"
    }

    private static func celsiusFromSwimmable(_ unitValue: SwimmableUnitValue?) -> Double? {
        guard let unitValue else { return nil }
        let u = unitValue.unit.trimmingCharacters(in: .whitespaces).lowercased()
        if u == "°c" || u == "c" {
            return unitValue.value
        }
        if u == "°f" || u == "f" {
            return (unitValue.value - 32.0) * 5.0 / 9.0
        }
        return unitValue.value
    }

    private static func dateFromISO(_ string: String) -> Date? {
        let fmt = ISO8601DateFormatter()
        fmt.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = fmt.date(from: string) { return d }
        fmt.formatOptions = [.withInternetDateTime]
        return fmt.date(from: string)
    }

    // MARK: - Generic HTTP helper

    private func shouldFallbackToPublicEndpoint(_ error: RealTimeWaterServiceError) -> Bool {
        guard let code = error.statusCode else { return false }
        return code == 401 || code == 403 || code == 404
    }

    private func performConditionsRequest<T: Decodable>(
        endpoint: String,
        lat: Double,
        lon: Double,
        includeAPIKey: Bool,
        type: T.Type
    ) async throws -> T {
        guard var components = URLComponents(string: "\(baseURL)\(endpoint)") else {
            throw RealTimeWaterServiceError.invalidURL
        }
        components.queryItems = [
            URLQueryItem(name: "lat", value: String(lat)),
            URLQueryItem(name: "lon", value: String(lon)),
        ]
        return try await performGET(
            path: components.url?.absoluteString ?? "",
            includeAPIKey: includeAPIKey,
            type: type
        )
    }

    private func performGET<T: Decodable>(
        path: String,
        includeAPIKey: Bool,
        type: T.Type
    ) async throws -> T {
        guard let url = URL(string: path) else {
            throw RealTimeWaterServiceError.invalidURL
        }
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Swimmable-Python-SDK/1.0.0", forHTTPHeaderField: "User-Agent")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if includeAPIKey, let apiKey, !apiKey.isEmpty {
            request.setValue(apiKey, forHTTPHeaderField: "X-API-Key")
        }
        request.timeoutInterval = 15

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await urlSession.data(for: request)
        } catch {
            throw RealTimeWaterServiceError.networkError(error)
        }

        guard let http = response as? HTTPURLResponse else {
            throw RealTimeWaterServiceError.invalidResponse
        }

        guard (200..<300).contains(http.statusCode) else {
            if http.statusCode == 429 {
                let parsed = try? jsonDecoder.decode(SwimmableErrorBody.self, from: data)
                let retryMinutes: Int
                if let str = parsed?.retryAfter,
                   let n = Int(str.filter(\.isWholeNumber)), n > 0 {
                    retryMinutes = n
                } else {
                    retryMinutes = 5
                }
                throw RealTimeWaterServiceError.rateLimitExceeded(
                    retryAfterMinutes: retryMinutes,
                    signupURL: parsed?.signup
                )
            }
            if http.statusCode >= 500 {
                let parsed = try? jsonDecoder.decode(SwimmableErrorBody.self, from: data)
                throw RealTimeWaterServiceError.serverError(
                    statusCode: http.statusCode,
                    message: parsed?.message ?? parsed?.error ?? String(data: data, encoding: .utf8) ?? "<empty>"
                )
            }
            let body = String(data: data, encoding: .utf8) ?? "<empty>"
            throw RealTimeWaterServiceError.dataSourceUnavailable(
                "HTTP \(http.statusCode) - \(body)"
            )
        }

        do {
            return try jsonDecoder.decode(T.self, from: data)
        } catch {
            throw RealTimeWaterServiceError.decodingError(error)
        }
    }
}

private extension Double {
    func rounded(to places: Int) -> Double {
        let multiplier = pow(10.0, Double(places))
        return (self * multiplier).rounded() / multiplier
    }
}
