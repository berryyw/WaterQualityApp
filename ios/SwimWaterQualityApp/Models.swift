import CoreLocation
import Foundation

enum PoolQualityGrade: String, CaseIterable, Codable, Identifiable {
    case excellent
    case good
    case attention

    var id: String { rawValue }

    var title: String {
        switch self {
        case .excellent:
            return "优"
        case .good:
            return "良"
        case .attention:
            return "关注"
        }
    }

    var detail: String {
        switch self {
        case .excellent:
            return "主要指标表现稳定，适合日常训练与亲子游泳。"
        case .good:
            return "整体处于达标范围，建议结合更新时间一起判断。"
        case .attention:
            return "部分指标接近提醒阈值，建议到馆前再次确认。"
        }
    }

    var symbolName: String {
        switch self {
        case .excellent:
            return "checkmark.seal.fill"
        case .good:
            return "drop.fill"
        case .attention:
            return "exclamationmark.triangle.fill"
        }
    }

    var tintHex: String {
        switch self {
        case .excellent:
            return "#0A84FF"
        case .good:
            return "#30B0C7"
        case .attention:
            return "#FF9F0A"
        }
    }

    var rank: Int {
        switch self {
        case .excellent:
            return 0
        case .good:
            return 1
        case .attention:
            return 2
        }
    }
}

enum MapDisplayMode: String, CaseIterable, Codable, Identifiable {
    case standard
    case hybrid
    case imagery

    var id: String { rawValue }

    var title: String {
        switch self {
        case .standard:
            return "标准"
        case .hybrid:
            return "混合"
        case .imagery:
            return "影像"
        }
    }
}

enum AppTab: Hashable {
    case map
    case trending
    case profile
}

struct SupportedCity: RawRepresentable, Codable, Identifiable, Hashable {
    let rawValue: String
    private let customTitle: String?
    private let customSubtitle: String?

    init(rawValue: String) {
        self.rawValue = rawValue.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        self.customTitle = nil
        self.customSubtitle = nil
    }

    init(rawValue: String, title: String?, subtitle: String? = nil) {
        self.rawValue = rawValue.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        self.customTitle = title?.trimmingCharacters(in: .whitespacesAndNewlines)
        self.customSubtitle = subtitle?.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var id: String { rawValue }

    var title: String {
        if let customTitle, !customTitle.isEmpty {
            return customTitle
        }

        return Self.defaultMetadata[rawValue]?.title ?? rawValue.uppercased()
    }

    var subtitle: String {
        if let customSubtitle, !customSubtitle.isEmpty {
            return customSubtitle
        }

        return Self.defaultMetadata[rawValue]?.subtitle ?? "已接入城市"
    }

    static let losAngeles = SupportedCity(rawValue: "la", title: "洛杉矶", subtitle: "美国西海岸 · Los Angeles")
    static let beijing = SupportedCity(rawValue: "beijing", title: "北京", subtitle: "默认城市")
    static let shanghai = SupportedCity(rawValue: "shanghai", title: "上海", subtitle: "华东核心城市")
    static let shenzhen = SupportedCity(rawValue: "shenzhen", title: "深圳", subtitle: "华南核心城市")
    static let guangzhou = SupportedCity(rawValue: "gz", title: "广州", subtitle: "华南核心城市")

    static let allCases: [SupportedCity] = [
        .losAngeles,
        .beijing,
        .shanghai,
        .shenzhen,
    ]

    private static let defaultMetadata: [String: (title: String, subtitle: String)] = [
        losAngeles.rawValue: (losAngeles.title, losAngeles.subtitle),
        beijing.rawValue: (beijing.title, beijing.subtitle),
        shanghai.rawValue: (shanghai.title, shanghai.subtitle),
        shenzhen.rawValue: (shenzhen.title, shenzhen.subtitle),
        guangzhou.rawValue: (guangzhou.title, guangzhou.subtitle),
    ]

    static func == (lhs: SupportedCity, rhs: SupportedCity) -> Bool {
        lhs.rawValue == rhs.rawValue
    }

    func hash(into hasher: inout Hasher) {
        hasher.combine(rawValue)
    }
}

enum VerificationPurpose: String, Codable {
    case firstLogin
    case changeEmail
    case changePassword
}

struct AppUser: Identifiable, Codable, Hashable {
    var email: String
    var nickname: String
    var avatarData: Data?
    var avatarURL: String?
    var followedVenueIDs: [String]

    var id: String { email.lowercased() }

    var initials: String {
        let source = nickname.trimmingCharacters(in: .whitespacesAndNewlines)
        if !source.isEmpty {
            return String(source.prefix(1))
        }

        return String(email.prefix(1)).uppercased()
    }
}

struct VenueArtworkStyle: Codable, Hashable {
    var symbolName: String
    var topColorHex: String
    var bottomColorHex: String
    var accentColorHex: String
}

struct VenueReview: Identifiable, Codable, Hashable {
    var id: String
    var userName: String
    var userAvatarSymbol: String
    var userAvatarHex: String
    var content: String
    var createdAt: Date
}

struct WaterQualityMetric: Identifiable, Hashable {
    var id: String
    var title: String
    var englishTitle: String
    var value: String
    var note: String?
}

struct WaterQualityMetricSection: Identifiable, Hashable {
    var id: String
    var title: String
    var metrics: [WaterQualityMetric]
}

struct WaterQualityReport: Codable, Hashable {
    var grade: PoolQualityGrade
    var note: String
    var updatedAt: Date
    var turbidity: Double
    var waterTemperature: Double
    var potentialHydrogenValue: Double
    var freeChlorine: Double
    var combinedChlorine: Double
    var orp: Int
    var bacterialCount: String
    var totalColiforms: String
    var urea: Double
    var cyanuricAcid: Double
    var tds: Int

    var summaryLine: String {
        "浑浊度 \(formattedTurbidity) · 水温 \(formattedTemperature) · PH \(formattedPH)"
    }

    var formattedTurbidity: String {
        String(format: "%.2f NTU", turbidity)
    }

    var formattedTemperature: String {
        String(format: "%.1f ℃", waterTemperature)
    }

    var formattedPH: String {
        String(format: "%.2f", potentialHydrogenValue)
    }

    var formattedFreeChlorine: String {
        String(format: "%.2f mg/L", freeChlorine)
    }

    var formattedCombinedChlorine: String {
        String(format: "%.2f mg/L", combinedChlorine)
    }

    var formattedORP: String {
        "\(orp) mV"
    }

    var formattedUrea: String {
        String(format: "%.2f mg/L", urea)
    }

    var formattedCyanuricAcid: String {
        String(format: "%.1f mg/L", cyanuricAcid)
    }

    var formattedTDS: String {
        "\(tds) ppm"
    }

    var sections: [WaterQualityMetricSection] {
        [
            WaterQualityMetricSection(
                id: "physical",
                title: "物理性指标",
                metrics: [
                    WaterQualityMetric(
                        id: "turbidity",
                        title: "浑浊度",
                        englishTitle: "Turbidity",
                        value: formattedTurbidity,
                        note: "数值越低通常越清澈"
                    ),
                    WaterQualityMetric(
                        id: "temperature",
                        title: "水温",
                        englishTitle: "Water Temperature",
                        value: formattedTemperature,
                        note: "适合训练与舒适度判断"
                    )
                ]
            ),
            WaterQualityMetricSection(
                id: "chemical",
                title: "化学性指标",
                metrics: [
                    WaterQualityMetric(
                        id: "PH",
                        title: "PH值",
                        englishTitle: "PH",
                        value: formattedPH,
                        note: "通常建议维持在适宜范围"
                    ),
                    WaterQualityMetric(
                        id: "freeChlorine",
                        title: "游离性余氯",
                        englishTitle: "Free Chlorine",
                        value: formattedFreeChlorine,
                        note: nil
                    ),
                    WaterQualityMetric(
                        id: "combinedChlorine",
                        title: "化合性余氯",
                        englishTitle: "Combined Chlorine",
                        value: formattedCombinedChlorine,
                        note: nil
                    ),
                    WaterQualityMetric(
                        id: "orp",
                        title: "氧化还原电位",
                        englishTitle: "ORP",
                        value: formattedORP,
                        note: "体现消毒有效性"
                    )
                ]
            ),
            WaterQualityMetricSection(
                id: "microbial",
                title: "微生物指标",
                metrics: [
                    WaterQualityMetric(
                        id: "bacterial",
                        title: "菌落总数",
                        englishTitle: "Total Plate Count",
                        value: bacterialCount,
                        note: nil
                    ),
                    WaterQualityMetric(
                        id: "coliforms",
                        title: "总大肠菌群",
                        englishTitle: "Total Coliforms",
                        value: totalColiforms,
                        note: nil
                    )
                ]
            ),
            WaterQualityMetricSection(
                id: "other",
                title: "其他指标",
                metrics: [
                    WaterQualityMetric(
                        id: "urea",
                        title: "尿素",
                        englishTitle: "Urea",
                        value: formattedUrea,
                        note: nil
                    ),
                    WaterQualityMetric(
                        id: "cyanuricAcid",
                        title: "氰尿酸",
                        englishTitle: "Cyanuric Acid",
                        value: formattedCyanuricAcid,
                        note: nil
                    ),
                    WaterQualityMetric(
                        id: "tds",
                        title: "溶解性总固体",
                        englishTitle: "TDS",
                        value: formattedTDS,
                        note: nil
                    )
                ]
            )
        ]
    }
}

struct SwimVenue: Identifiable, Codable, Hashable {
    var id: String
    var city: SupportedCity
    var name: String
    var district: String
    var address: String
    var latitude: Double
    var longitude: Double
    var coverStyle: VenueArtworkStyle
    var summary: String
    var imageCaption: String
    var followersCount: Int
    var openedAt: Date
    var rankingMomentum: Int
    var waterQuality: WaterQualityReport
    var reviews: [VenueReview]

    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }

    var locationSummary: String {
        "\(city.title) · \(district)"
    }

    var displayName: String {
        let range = name.range(of: " at ")
        if let range, range.lowerBound != name.startIndex {
            let trimmed = String(name[..<range.lowerBound]).trimmingCharacters(in: .whitespacesAndNewlines)
            return trimmed.isEmpty ? name : trimmed
        }
        return name
    }

    var coordinatesText: String {
        String(format: "%.4f, %.4f", latitude, longitude)
    }
}
