import SwiftUI

struct VenueDetailView: View {
    let venue: SwimVenue

    @EnvironmentObject private var store: SwimAppStore
    @State private var isSubmittingFollow = false
    @State private var isSubmittingReview = false
    @State private var isReviewSheetPresented = false
    @State private var reviewDraft = ""
    @State private var errorMessage: String?
    @State private var followToastMessage: String?

    private var currentVenue: SwimVenue {
        store.venue(for: venue.id) ?? venue
    }

    private var reviews: [VenueReview] {
        store.reviews(for: currentVenue)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: AppSpacing.lg) {
                headerCard
                qualityOverviewCard
                qualitySectionsCard
                reviewCard
            }
            .padding(.horizontal, AppSpacing.lg)
            .padding(.top, AppSpacing.md)
            .padding(.bottom, AppSpacing.xl)
        }
        .scrollIndicators(.hidden)
        .background(Color(.systemGroupedBackground))
        .navigationTitle("泳馆详情")
        .navigationBarTitleDisplayMode(.inline)
        .appNavigationChrome()
        .alert("提示", isPresented: errorBinding) {
            Button("知道了", role: .cancel) {}
        } message: {
            Text(errorMessage ?? "")
        }
        .overlay(alignment: .top) {
            if let followToastMessage {
                FollowStatusToast(message: followToastMessage)
                    .padding(.top, 8)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .sheet(isPresented: $isReviewSheetPresented) {
            reviewComposerSheet
        }
        .task {
            do {
                try await store.loadReviews(for: venue.id)
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    private var errorBinding: Binding<Bool> {
        Binding(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )
    }

    private var headerCard: some View {
        VStack(alignment: .leading, spacing: AppSpacing.md) {
            VenueArtworkView(venue: currentVenue, height: 220)

            HStack(alignment: .top, spacing: AppSpacing.md) {
                VStack(alignment: .leading, spacing: AppSpacing.xs) {
                    Text(currentVenue.name)
                        .font(.title2.bold())

                    Text(currentVenue.locationSummary)
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(.secondary)

                    Text(currentVenue.address)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)

                    Label("坐标 \(currentVenue.coordinatesText)", systemImage: "mappin.circle")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                WaterQualityBadgeView(grade: currentVenue.waterQuality.grade, detail: currentVenue.waterQuality.note)
                    .frame(width: 136)
            }

            Text(currentVenue.summary)
                .font(.subheadline)
                .foregroundStyle(.secondary)

            HStack(spacing: AppSpacing.sm) {
                statPill(symbol: "heart.fill", text: "\(store.followerCount(for: currentVenue)) 人关注")
                statPill(symbol: "clock.fill", text: currentVenue.waterQuality.updatedAt.formatted(date: .abbreviated, time: .shortened))
            }

            HStack(spacing: AppSpacing.sm) {
                Button(isSubmittingFollow ? "处理中..." : (store.isFollowed(currentVenue.id) ? "取消关注" : "关注泳馆")) {
                    Task { await toggleFollow() }
                }
                .buttonStyle(.borderedProminent)
                .tint(store.isFollowed(currentVenue.id) ? AppTint.warning : AppTint.primary)
                .disabled(isSubmittingFollow)

                Button("评价") {
                    reviewDraft = ""
                    isReviewSheetPresented = true
                }
                .buttonStyle(.bordered)
                .tint(AppTint.primary)
            }
        }
        .appCardStyle()
    }

    private var qualityOverviewCard: some View {
        VStack(alignment: .leading, spacing: AppSpacing.md) {
            HStack {
                Text("水质概览")
                    .font(.headline)
                Spacer()
                Text(currentVenue.waterQuality.grade.detail)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            HStack(spacing: AppSpacing.sm) {
                metricCard(title: "浑浊度", value: currentVenue.waterQuality.formattedTurbidity)
                metricCard(title: "水温", value: currentVenue.waterQuality.formattedTemperature)
                metricCard(title: "PH", value: currentVenue.waterQuality.formattedPH)
            }

            Text(currentVenue.waterQuality.note)
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .appCardStyle()
    }

    private var qualitySectionsCard: some View {
        VStack(alignment: .leading, spacing: AppSpacing.lg) {
            Text("完整水质信息")
                .font(.headline)

            ForEach(currentVenue.waterQuality.sections) { section in
                VStack(alignment: .leading, spacing: AppSpacing.sm) {
                    Text(section.title)
                        .font(.subheadline.weight(.semibold))

                    ForEach(section.metrics) { metric in
                        HStack(alignment: .top, spacing: AppSpacing.md) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(metric.title)
                                    .font(.subheadline.weight(.medium))
                                Text(metric.englishTitle)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }

                            Spacer()

                            VStack(alignment: .trailing, spacing: 2) {
                                Text(metric.value)
                                    .font(.subheadline.weight(.semibold))
                                if let note = metric.note {
                                    Text(note)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                        .multilineTextAlignment(.trailing)
                                }
                            }
                        }
                        .padding(.vertical, 6)
                    }
                }
            }
        }
        .appCardStyle()
    }

    private var reviewCard: some View {
        VStack(alignment: .leading, spacing: AppSpacing.md) {
            HStack {
                Text("用户评价")
                    .font(.headline)
                Spacer()
                if !reviews.isEmpty {
                    Text("\(reviews.count) 条")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            if reviews.isEmpty {
                Text("还没有用户评价，欢迎成为第一个留下体验的人。")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            } else {
                ForEach(reviews) { review in
                    ReviewRowView(review: review)
                        .padding(.vertical, 4)
                }
            }
        }
        .appCardStyle()
    }

    private var reviewComposerSheet: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: AppSpacing.md) {
                Text("写下你对这家泳馆的真实体验，内容需控制在 200 字以内。")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)

                TextEditor(text: $reviewDraft)
                    .frame(minHeight: 160)
                    .padding(AppSpacing.sm)
                    .background(Color(.tertiarySystemBackground).opacity(0.8))
                    .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                    .onChange(of: reviewDraft) { _, newValue in
                        if newValue.count > 200 {
                            reviewDraft = String(newValue.prefix(200))
                        }
                    }

                HStack {
                    Spacer()
                    Text("\(reviewDraft.count)/200")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer()
            }
            .padding(AppSpacing.lg)
            .navigationTitle("发表评价")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("取消") {
                        isReviewSheetPresented = false
                    }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button(isSubmittingReview ? "提交中" : "提交") {
                        submitReview()
                    }
                    .disabled(isSubmittingReview || reviewDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
        }
        .presentationDetents([.height(360)])
        .presentationDragIndicator(.visible)
    }

    private func toggleFollow() async {
        isSubmittingFollow = true
        defer { isSubmittingFollow = false }

        do {
            let wasFollowed = store.isFollowed(venue.id)
            try await store.toggleFollow(for: currentVenue)
            showFollowToast(wasFollowed ? "已取消关注" : "关注成功")
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func showFollowToast(_ message: String) {
        withAnimation(AppMotion.emphasis) {
            followToastMessage = message
        }

        Task {
            try? await Task.sleep(for: .seconds(1.6))
            await MainActor.run {
                guard followToastMessage == message else { return }
                withAnimation(AppMotion.quick) {
                    followToastMessage = nil
                }
            }
        }
    }


private struct FollowStatusToast: View {
    let message: String

    var body: some View {
        Label(message, systemImage: "checkmark.circle.fill")
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(AppTint.success)
            .padding(.horizontal, AppSpacing.md)
            .padding(.vertical, 12)
            .background(Color(.secondarySystemBackground).opacity(0.96))
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .stroke(Color.white.opacity(0.72), lineWidth: 1)
            )
            .shadow(color: AppTint.success.opacity(0.10), radius: 12, x: 0, y: 8)
    }
}

    private func submitReview() {
        Task {
            isSubmittingReview = true
            defer { isSubmittingReview = false }

            do {
                try await store.submitReview(for: currentVenue, content: reviewDraft)
                reviewDraft = ""
                isReviewSheetPresented = false
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    private func metricCard(title: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.headline)
                .minimumScaleFactor(0.78)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, AppSpacing.sm)
        .padding(.horizontal, AppSpacing.sm)
        .background(Color(.tertiarySystemBackground).opacity(0.75))
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
    }

    private func statPill(symbol: String, text: String) -> some View {
        Label(text, systemImage: symbol)
            .font(.caption.weight(.medium))
            .padding(.horizontal, AppSpacing.sm)
            .padding(.vertical, 8)
            .background(Color(.tertiarySystemBackground))
            .clipShape(Capsule())
    }
}

struct VenueListCardView: View {
    let venue: SwimVenue
    let followerCount: Int
    let distanceText: String?

    var body: some View {
        HStack(spacing: AppSpacing.md) {
            VenueArtworkView(venue: venue, height: 92)
                .frame(width: 104)

            VStack(alignment: .leading, spacing: AppSpacing.xs) {
                HStack {
                    Text(venue.displayName)
                        .font(.headline)
                        .lineLimit(2)
                    Spacer(minLength: 0)
                    Text(venue.waterQuality.grade.title)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(venue.waterQuality.grade.tintColor)
                }

                Text(venue.address)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)

                HStack(spacing: AppSpacing.sm) {
                    Label("\(followerCount)", systemImage: "heart.fill")
                    Label(distanceText ?? venue.city.title, systemImage: "location.fill")
                }
                .font(.caption)
                .foregroundStyle(.secondary)
            }
        }
        .appCardStyle()
    }
}

struct VenueArtworkView: View {
    let venue: SwimVenue
    var height: CGFloat = 140

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: [
                            Color(hex: venue.coverStyle.topColorHex),
                            Color(hex: venue.coverStyle.bottomColorHex)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )

            Circle()
                .fill(Color.white.opacity(0.18))
                .frame(width: height * 0.72, height: height * 0.72)
                .offset(x: height * 0.2, y: -height * 0.3)

            Image(systemName: venue.coverStyle.symbolName)
                .font(.system(size: height * 0.34, weight: .semibold))
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)

            VStack(alignment: .leading, spacing: 4) {
                Text(venue.locationSummary)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Color.white.opacity(0.92))
                Text(venue.imageCaption)
                    .font(.caption2)
                    .foregroundStyle(Color.white.opacity(0.82))
                    .lineLimit(2)
            }
            .padding(AppSpacing.md)
        }
        .frame(maxWidth: .infinity)
        .frame(height: height)
        .overlay(
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .stroke(Color.white.opacity(0.14), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
    }
}

private struct ReviewRowView: View {
    let review: VenueReview

    var body: some View {
        HStack(alignment: .top, spacing: AppSpacing.md) {
            ReviewAvatarView(review: review)
                .frame(width: 42, height: 42)

            VStack(alignment: .leading, spacing: 6) {
                HStack(alignment: .center, spacing: 8) {
                    Text(review.userName)
                        .font(.subheadline.weight(.semibold))
                        .lineLimit(1)

                    ReviewSourceBadge(source: review.source)

                    Spacer(minLength: 8)

                    Text(timeLabel)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }

                HStack(spacing: 2) {
                    if let rating = review.rating, rating > 0 {
                        StarRatingView(rating: rating, size: 12)
                    }
                    Spacer()
                }

                if !review.content.isEmpty {
                    Text(review.content)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
    }

    private var timeLabel: String {
        if let rel = review.relativeTime, !rel.isEmpty {
            return rel
        }
        return review.createdAt.formatted(date: .abbreviated, time: .shortened)
    }
}

private struct ReviewAvatarView: View {
    let review: VenueReview

    var body: some View {
        Group {
            if let url = avatarURL {
                AsyncImage(url: url, transaction: .init(animation: .easeIn(duration: 0.2))) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .scaledToFill()
                    case .failure:
                        fallbackSymbol
                    case .empty:
                        ProgressView()
                            .progressViewStyle(.circular)
                            .tint(.white)
                    @unknown default:
                        fallbackSymbol
                    }
                }
            } else {
                fallbackSymbol
            }
        }
        .frame(width: 42, height: 42)
        .background(Color(hex: review.userAvatarHex))
        .clipShape(Circle())
    }

    private var fallbackSymbol: some View {
        Image(systemName: review.userAvatarSymbol)
            .font(.headline)
            .foregroundStyle(.white)
    }

    private var avatarURL: URL? {
        guard let raw = review.userAvatarURL, !raw.isEmpty else { return nil }
        return URL(string: raw)
    }
}

private struct StarRatingView: View {
    let rating: Int
    var size: CGFloat = 13
    var filledTint: Color = Color(red: 0.98, green: 0.75, blue: 0.15)
    var emptyTint: Color = Color(.tertiaryLabel)

    var body: some View {
        HStack(spacing: 0) {
            ForEach(1..<6, id: \.self) { i in
                Image(systemName: i <= rating ? "star.fill" : "star")
                    .font(.system(size: size, weight: .semibold))
                    .foregroundStyle(i <= rating ? filledTint : emptyTint)
            }
        }
        .accessibilityLabel("评分 \(rating) 星")
    }
}

private struct ReviewSourceBadge: View {
    let source: VenueReviewSource

    var body: some View {
        switch source {
        case .google:
            HStack(spacing: 4) {
                Image(systemName: "mappin.and.ellipse")
                    .font(.caption2.weight(.semibold))
                Text("来自 Google Maps")
                    .font(.caption2.weight(.semibold))
            }
            .padding(.horizontal, 7)
            .padding(.vertical, 3)
            .background(Color(.tertiarySystemBackground).opacity(0.85))
            .foregroundStyle(.secondary)
            .clipShape(Capsule())
        case .app:
            EmptyView()
        }
    }
}
