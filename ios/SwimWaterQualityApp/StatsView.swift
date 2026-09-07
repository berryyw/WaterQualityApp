import SwiftUI

private enum TrendingCollectionKind: Hashable {
    case newArrivals
    case excellentQuality
    case fastestRising

    var title: String {
        switch self {
        case .newArrivals:
            return "新上场馆"
        case .excellentQuality:
            return "优质等级"
        case .fastestRising:
            return "上升最快"
        }
    }

    var subtitle: String {
        switch self {
        case .newArrivals:
            return "近三个月新增的游泳馆"
        case .excellentQuality:
            return "当前城市优质水准泳馆"
        case .fastestRising:
            return "近三个月排名提升最快"
        }
    }

    var symbol: String {
        switch self {
        case .newArrivals:
            return "sparkles"
        case .excellentQuality:
            return "checkmark.seal.fill"
        case .fastestRising:
            return "arrow.up.forward.circle.fill"
        }
    }

    var accent: Color {
        switch self {
        case .newArrivals:
            return AppTint.primary
        case .excellentQuality:
            return AppTint.cyan
        case .fastestRising:
            return AppTint.warning
        }
    }

    var emptyTitle: String {
        switch self {
        case .newArrivals:
            return "近三个月暂无新上场馆"
        case .excellentQuality:
            return "当前城市暂无优质等级场馆"
        case .fastestRising:
            return "当前城市暂无上升最快场馆"
        }
    }

    var emptyMessage: String {
        switch self {
        case .newArrivals:
            return "可以切换城市，查看其他城市近三个月新增的泳馆。"
        case .excellentQuality:
            return "可以切换城市，查看当前水质表现更稳定的泳馆。"
        case .fastestRising:
            return "可以切换城市，查看近期热度提升更明显的泳馆。"
        }
    }
}

struct TrendingView: View {
    @EnvironmentObject private var store: SwimAppStore

    @State private var path: [SwimVenue] = []
    @State private var hasAnimatedIn = false

    private var topThreeVenues: [SwimVenue] {
        Array(store.trendingVenues.prefix(3))
    }

    private var rankingVenues: [SwimVenue] {
        Array(store.trendingVenues.dropFirst(3))
    }

    var body: some View {
        NavigationStack(path: $path) {
            ZStack(alignment: .top) {
                trendingBackground

                ScrollView {
                    VStack(spacing: AppSpacing.lg) {
                        heroCard
                        rankSummaryCard
                        rankingListSection
                    }
                    .padding(.horizontal, AppSpacing.lg)
                    .padding(.top, AppSpacing.md)
                    .padding(.bottom, AppSpacing.xl)
                }
            }
            .scrollIndicators(.hidden)
            .background(Color(.systemGroupedBackground))
            .navigationTitle("热度")
            .navigationBarTitleDisplayMode(.inline)
            .navigationDestination(for: SwimVenue.self) { venue in
                VenueDetailView(venue: venue)
            }
            .appNavigationChrome()
            .toolbar {
                ToolbarItem(placement: .principal) {
                    Text("热度")
                        .font(.headline.weight(.semibold))
                }
            }
            .onAppear {
                guard !hasAnimatedIn else { return }
                hasAnimatedIn = true
                if store.userLocation == nil {
                    store.applyDefaultCurrentCitySelection()
                    store.requestCurrentLocation(focusMap: false)
                } else {
                    store.applyDefaultCurrentCitySelection()
                }
            }
            .onChange(of: store.userLocation) { _, newValue in
                guard newValue != nil else { return }
                store.applyDefaultCurrentCitySelection()
            }
        }
    }

    private var trendingBackground: some View {
        ZStack {
            Color(.systemGroupedBackground)

            Circle()
                .fill(AppTint.primary.opacity(0.16))
                .frame(width: 320, height: 320)
                .blur(radius: 52)
                .offset(x: -120, y: -180)

            Circle()
                .fill(AppTint.cyan.opacity(0.16))
                .frame(width: 260, height: 260)
                .blur(radius: 46)
                .offset(x: 130, y: -120)
        }
        .ignoresSafeArea()
    }

    private var heroCard: some View {
        VStack(alignment: .leading, spacing: AppSpacing.lg) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: AppSpacing.xs) {
                    Text("CITY TRENDING")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(AppTint.primary)

                    Text("同城 Top3")
                        .font(.system(size: 30, weight: .bold, design: .rounded))
                }

                Spacer(minLength: 12)

                Menu {
                    ForEach(store.allCities) { city in
                        Button {
                            store.switchCity(to: city)
                        } label: {
                            if city == store.currentCity {
                                Label(city.title, systemImage: "checkmark")
                            } else {
                                Text(city.title)
                            }
                        }
                    }
                } label: {
                    HStack(spacing: 6) {
                        Text(store.currentCity.title)
                        Image(systemName: "chevron.down")
                            .font(.caption2.weight(.bold))
                    }
                    .font(.caption.weight(.bold))
                    .padding(.horizontal, 12)
                    .padding(.vertical, 7)
                    .background(.ultraThinMaterial)
                    .clipShape(Capsule())
                }
            }

            if topThreeVenues.isEmpty {
                EmptyStateCard(
                    symbol: "chart.bar.xaxis",
                    title: "当前城市暂无热度数据",
                    message: "切换城市后，可查看同城关注热度最高的泳馆。"
                )
            } else {
                VStack(spacing: AppSpacing.md) {
                    ForEach(Array(topThreeVenues.enumerated()), id: \.element.id) { index, venue in
                        Button {
                            store.centerOnVenue(venue)
                            path.append(venue)
                        } label: {
                            topThreeCard(for: venue, rank: index + 1)
                        }
                        .buttonStyle(.plain)
                        .buttonStyle(AppPressableButtonStyle())
                    }
                }
            }
        }
        .appCardStyle()
        .appEntrance(isVisible: hasAnimatedIn, delay: 0.03)
    }

    private var rankSummaryCard: some View {
        HStack(spacing: AppSpacing.sm) {
            summaryTileLink(kind: .newArrivals, venues: store.newArrivalVenues)
            summaryTileLink(kind: .excellentQuality, venues: store.excellentVenues)
            summaryTileLink(kind: .fastestRising, venues: store.fastestRisingVenues)
        }
        .appEntrance(isVisible: hasAnimatedIn, delay: 0.08)
    }

    private var rankingListSection: some View {
        VStack(alignment: .leading, spacing: AppSpacing.md) {
            Text("同城排行")
                .font(.headline)

            if rankingVenues.isEmpty {
                EmptyStateCard(
                    symbol: "chart.bar.xaxis",
                    title: "当前城市暂无更多排行数据",
                    message: "同城 Top3 已展示当前最热门场馆，更多排名数据会在这里继续补充。"
                )
            } else {
                ForEach(Array(rankingVenues.enumerated()), id: \.element.id) { index, venue in
                    NavigationLink(value: venue) {
                        TrendingRankingCard(venue: venue, index: index + 4)
                    }
                    .buttonStyle(.plain)
                    .buttonStyle(AppPressableButtonStyle())
                    .simultaneousGesture(
                        TapGesture().onEnded {
                            store.centerOnVenue(venue)
                        }
                    )
                    .appEntrance(isVisible: hasAnimatedIn, delay: 0.12 + (Double(index) * 0.03))
                }
            }
        }
    }

    private func topThreeCard(for venue: SwimVenue, rank: Int) -> some View {
        let accent = trendingRankAccent(index: rank)

        return HStack(spacing: AppSpacing.md) {
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack(spacing: 8) {
                            ZStack {
                                Circle()
                                    .fill(accent.opacity(0.18))
                                    .frame(width: 40, height: 40)

                                VStack(spacing: 1) {
                                    Image(systemName: trendingMedalSymbol(rank: rank))
                                        .font(.caption2.weight(.bold))
                                    Text("TOP\(rank)")
                                        .font(.system(size: 9, weight: .black, design: .rounded))
                                }
                                .foregroundStyle(accent)
                            }

                            Text(trendingMedalTitle(rank: rank))
                                .font(.caption.weight(.bold))
                                .foregroundStyle(accent)
                        }

                        Text(venue.displayName)
                            .font(.headline.weight(.bold))
                            .foregroundStyle(.primary)
                            .lineLimit(2)
                    }

                    Spacer(minLength: 8)

                    Text(venue.waterQuality.grade.title)
                        .font(.caption.weight(.bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(venue.waterQuality.grade.tintColor.opacity(0.92))
                        .clipShape(Capsule())
                }

                Text(venue.summary)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)

                HStack(spacing: AppSpacing.sm) {
                    TrendingMetaPill(symbol: "heart.fill", text: "\(store.followerCount(for: venue)) 人")
                    TrendingMetaPill(symbol: "mappin.circle.fill", text: venue.district)
                    if let distanceText = store.distanceText(for: venue) {
                        TrendingMetaPill(symbol: "location.fill", text: distanceText)
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, AppSpacing.md)
        .padding(.vertical, 14)
        .background(
            RoundedRectangle(cornerRadius: AppRadius.card, style: .continuous)
                .fill(Color.white.opacity(0.56))
                .background(
                    .ultraThinMaterial,
                    in: RoundedRectangle(cornerRadius: AppRadius.card, style: .continuous)
                )
        )
        .overlay(
            RoundedRectangle(cornerRadius: AppRadius.card, style: .continuous)
                .stroke(
                    LinearGradient(
                        colors: [accent.opacity(0.52), Color.white.opacity(0.78)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    lineWidth: 1.2
                )
        )
        .shadow(color: accent.opacity(0.12), radius: 18, x: 0, y: 12)
    }

    private func summaryTileLink(kind: TrendingCollectionKind, venues: [SwimVenue]) -> some View {
        NavigationLink {
            TrendingCollectionListView(kind: kind, venues: venues)
        } label: {
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .top) {
                    Image(systemName: kind.symbol)
                        .font(.caption.weight(.bold))
                        .foregroundStyle(kind.accent)
                        .frame(width: 24, height: 24)
                        .background(kind.accent.opacity(0.12))
                        .clipShape(Circle())

                    Spacer(minLength: 6)

                    Image(systemName: "chevron.right")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(.tertiary)
                }

                Spacer(minLength: 2)

                Text("\(venues.count)")
                    .font(.title3.weight(.bold))
                    .monospacedDigit()

                Text(kind.title)
                    .font(.caption.weight(.medium))
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .frame(height: 108)
            .padding(.vertical, 12)
            .padding(.horizontal, AppSpacing.md)
            .background(
                RoundedRectangle(cornerRadius: 24, style: .continuous)
                    .fill(Color.white.opacity(0.52))
                    .background(
                        .ultraThinMaterial,
                        in: RoundedRectangle(cornerRadius: 24, style: .continuous)
                    )
            )
            .overlay(
                RoundedRectangle(cornerRadius: 24, style: .continuous)
                    .stroke(Color.white.opacity(0.72), lineWidth: 1)
            )
            .shadow(color: kind.accent.opacity(0.10), radius: 14, x: 0, y: 10)
        }
        .buttonStyle(.plain)
        .buttonStyle(AppPressableButtonStyle())
    }
}

private struct TrendingCollectionListView: View {
    @EnvironmentObject private var store: SwimAppStore

    let kind: TrendingCollectionKind
    let venues: [SwimVenue]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: AppSpacing.md) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(kind.title)
                        .font(.headline)

                    Text(kind.subtitle)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                if venues.isEmpty {
                    EmptyStateCard(
                        symbol: kind.symbol,
                        title: kind.emptyTitle,
                        message: kind.emptyMessage
                    )
                } else {
                    ForEach(Array(venues.enumerated()), id: \.element.id) { index, venue in
                        NavigationLink {
                            VenueDetailView(venue: venue)
                        } label: {
                            TrendingRankingCard(venue: venue, index: index + 1)
                        }
                        .buttonStyle(.plain)
                        .buttonStyle(AppPressableButtonStyle())
                        .simultaneousGesture(
                            TapGesture().onEnded {
                                store.centerOnVenue(venue)
                            }
                        )
                    }
                }
            }
            .padding(.horizontal, AppSpacing.lg)
            .padding(.top, AppSpacing.md)
            .padding(.bottom, AppSpacing.xl)
        }
        .scrollIndicators(.hidden)
        .background(Color(.systemGroupedBackground))
        .navigationTitle(kind.title)
        .navigationBarTitleDisplayMode(.inline)
        .appNavigationChrome()
    }
}

struct TrendingRankingCard: View {
    @EnvironmentObject private var store: SwimAppStore

    let venue: SwimVenue
    let index: Int

    var body: some View {
        HStack(spacing: AppSpacing.md) {
            ZStack {
                Circle()
                    .fill(trendingRankAccent(index: index).opacity(0.12))
                    .frame(width: 56, height: 56)

                VStack(spacing: 1) {
                    if index <= 3 {
                        Image(systemName: index == 1 ? "crown.fill" : "flame.fill")
                            .font(.caption2.weight(.bold))
                    }

                    Text("#\(index)")
                        .font(.headline.weight(.bold))
                }
                .foregroundStyle(trendingRankAccent(index: index))
            }

            VStack(alignment: .leading, spacing: AppSpacing.sm) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(venue.displayName)
                            .font(.headline.weight(.semibold))
                            .lineLimit(2)

                        Text(venue.address)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }

                    Spacer(minLength: 8)

                    Text(venue.waterQuality.grade.title)
                        .font(.caption.weight(.bold))
                        .foregroundStyle(venue.waterQuality.grade.tintColor)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 7)
                        .background(venue.waterQuality.grade.tintColor.opacity(0.12))
                        .clipShape(Capsule())
                }

                HStack(spacing: AppSpacing.sm) {
                    TrendingMetaPill(symbol: "heart.fill", text: "\(store.followerCount(for: venue))")
                    TrendingMetaPill(symbol: "mappin.circle.fill", text: store.distanceText(for: venue) ?? venue.district)
                    if store.isFollowed(venue.id) {
                        TrendingMetaPill(symbol: "checkmark.circle.fill", text: "已关注")
                    }
                }

                Text(venue.waterQuality.summaryLine)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
        }
        .padding(AppSpacing.md)
        .background(
            RoundedRectangle(cornerRadius: AppRadius.card, style: .continuous)
                .fill(Color.white.opacity(0.56))
                .background(
                    .ultraThinMaterial,
                    in: RoundedRectangle(cornerRadius: AppRadius.card, style: .continuous)
                )
        )
        .overlay(
            RoundedRectangle(cornerRadius: AppRadius.card, style: .continuous)
                .stroke(Color.white.opacity(0.72), lineWidth: 1)
        )
        .shadow(color: trendingRankAccent(index: index).opacity(0.08), radius: 16, x: 0, y: 10)
    }
}

private struct TrendingMetaPill: View {
    let symbol: String
    let text: String

    var body: some View {
        Label(text, systemImage: symbol)
            .font(.caption.weight(.medium))
            .foregroundStyle(.secondary)
            .padding(.horizontal, 10)
            .padding(.vertical, 7)
            .background(Color(.tertiarySystemBackground).opacity(0.76))
            .clipShape(Capsule())
    }
}

private func trendingRankAccent(index: Int) -> Color {
    switch index {
    case 1:
        return AppTint.warning
    case 2:
        return Color(red: 0.63, green: 0.68, blue: 0.76)
    case 3:
        return Color(red: 0.77, green: 0.53, blue: 0.30)
    default:
        return AppTint.indigo
    }
}

private func trendingMedalTitle(rank: Int) -> String {
    switch rank {
    case 1:
        return "金牌 TOP1"
    case 2:
        return "银牌 TOP2"
    case 3:
        return "铜牌 TOP3"
    default:
        return "热门泳馆"
    }
}

private func trendingMedalSymbol(rank: Int) -> String {
    switch rank {
    case 1:
        return "crown.fill"
    case 2:
        return "medal.fill"
    case 3:
        return "seal.fill"
    default:
        return "flame.fill"
    }
}
