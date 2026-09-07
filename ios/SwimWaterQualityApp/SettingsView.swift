import PhotosUI
import SwiftUI
import UIKit

@MainActor
struct ProfileView: View {
    @EnvironmentObject private var store: SwimAppStore

    @State private var hasAnimatedIn = false
    @State private var selectedPhoto: PhotosPickerItem?
    @State private var isUpdatingAvatar = false
    @State private var isSigningOut = false
    @State private var showAvatarUpdatedToast = false
    @State private var showNicknameEditor = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            ZStack(alignment: .top) {
                profileBackground

                ScrollView {
                    VStack(spacing: AppSpacing.lg) {
                        heroCard
                        accountSecuritySection
                        followingSection
                        signOutSection
                    }
                    .padding(.horizontal, AppSpacing.lg)
                    .padding(.top, AppSpacing.md)
                    .padding(.bottom, AppSpacing.xl)
                }
            }
            .scrollIndicators(.hidden)
            .background(Color(.systemGroupedBackground))
            .navigationTitle("我的")
            .navigationBarTitleDisplayMode(.inline)
            .navigationDestination(for: SwimVenue.self) { venue in
                VenueDetailView(venue: venue)
            }
            .appNavigationChrome()
            .toolbar {
                ToolbarItem(placement: .principal) {
                    Text("我的")
                        .font(.headline.weight(.semibold))
                }
            }
            .alert("提示", isPresented: errorBinding) {
                Button("知道了", role: .cancel) {}
            } message: {
                Text(errorMessage ?? "")
            }
            .sheet(isPresented: $showNicknameEditor) {
                QuickEditNicknameSheet()
                    .environmentObject(store)
            }
            .overlay(alignment: .top) {
                if showAvatarUpdatedToast {
                    InlineSuccessToast(message: "头像已更新")
                        .padding(.top, 8)
                        .transition(.move(edge: .top).combined(with: .opacity))
                }
            }
            .onAppear {
                guard !hasAnimatedIn else { return }
                hasAnimatedIn = true
            }
            .onChange(of: selectedPhoto) { _, newValue in
                guard let newValue else { return }
                Task {
                    await updateAvatar(using: newValue)
                }
            }
        }
    }

    private var errorBinding: Binding<Bool> {
        Binding(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )
    }

    private var profileBackground: some View {
        ZStack {
            Color(.systemGroupedBackground)

            Circle()
                .fill(AppTint.indigo.opacity(0.16))
                .frame(width: 340, height: 340)
                .blur(radius: 56)
                .offset(x: -130, y: -220)

            Circle()
                .fill(AppTint.cyan.opacity(0.14))
                .frame(width: 260, height: 260)
                .blur(radius: 42)
                .offset(x: 150, y: -110)
        }
        .ignoresSafeArea()
    }

    private var heroCard: some View {
        let currentUser = store.currentUser
        let updatingAvatar = isUpdatingAvatar

        return ZStack(alignment: .topTrailing) {
            RoundedRectangle(cornerRadius: 34, style: .continuous)
                .fill(AppGradient.ocean)

            Circle()
                .fill(Color.white.opacity(0.12))
                .frame(width: 170, height: 170)
                .offset(x: 32, y: -10)

            Circle()
                .fill(Color.white.opacity(0.10))
                .frame(width: 120, height: 120)
                .offset(x: -40, y: 160)

            VStack(alignment: .leading, spacing: AppSpacing.md) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: AppSpacing.xs) {
                        Text("MY ACCOUNT")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(Color.white.opacity(0.78))
                    }

                    Spacer(minLength: 0)
                }

                HStack(alignment: .center, spacing: AppSpacing.md) {
                    PhotosPicker(selection: $selectedPhoto, matching: .images) {
                        ZStack(alignment: .bottomTrailing) {
                            UserAvatarView(user: currentUser, size: 84)

                            if updatingAvatar {
                                ProgressView()
                                    .controlSize(.small)
                                    .padding(8)
                                    .background(.ultraThinMaterial)
                                    .clipShape(Circle())
                            } else {
                                Image(systemName: "camera.fill")
                                    .font(.caption.weight(.bold))
                                    .foregroundStyle(AppTint.primary)
                                    .frame(width: 30, height: 30)
                                    .background(Color.white)
                                    .clipShape(Circle())
                            }
                        }
                    }
                    .disabled(isUpdatingAvatar)

                    VStack(alignment: .leading, spacing: AppSpacing.xs) {
                        HStack(spacing: 8) {
                            Text(currentUser?.nickname ?? "泳者")
                                .font(.system(size: 26, weight: .bold, design: .rounded))
                                .foregroundStyle(.white)

                            Button {
                                showNicknameEditor = true
                            } label: {
                                Image(systemName: "square.and.pencil")
                                    .font(.subheadline.weight(.bold))
                                    .foregroundStyle(AppTint.primary)
                                    .frame(width: 28, height: 28)
                                    .background(Color.white.opacity(0.92))
                                    .clipShape(Circle())
                            }
                            .buttonStyle(.plain)
                        }

                        Text(currentUser?.email ?? "未登录")
                            .font(.subheadline)
                            .foregroundStyle(Color.white.opacity(0.80))

                        heroPill(symbol: "heart.fill", text: "\(store.followingVenues.count) 个关注")
                    }
                }
            }
            .padding(AppSpacing.lg)
        }
        .frame(maxWidth: .infinity)
        .frame(height: 186)
        .overlay(
            RoundedRectangle(cornerRadius: 34, style: .continuous)
                .stroke(Color.white.opacity(0.20), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 34, style: .continuous))
        .shadow(color: AppTint.primary.opacity(0.16), radius: 26, x: 0, y: 18)
        .appEntrance(isVisible: hasAnimatedIn, delay: 0.03)
    }

    private var accountSecuritySection: some View {
        sectionCard(title: "账号信息", subtitle: "基础资料与安全设置") {
            profileRow(
                title: "邮箱",
                value: store.currentUser?.email ?? "未设置",
                symbol: "envelope.fill",
                accent: AppTint.cyan,
                showsChevron: false
            )

            divider

            NavigationLink {
                ChangePasswordView()
            } label: {
                profileRow(
                    title: "修改密码",
                    value: "8-20 位，含字母和数字",
                    symbol: "lock.fill",
                    accent: AppTint.indigo
                )
            }
            .buttonStyle(.plain)
        }
        .appEntrance(isVisible: hasAnimatedIn, delay: 0.08)
    }

    private var followingSection: some View {
        sectionCard(title: "我的关注", subtitle: "快速查看你最常去的泳馆") {
            NavigationLink {
                FollowingVenuesView()
            } label: {
                profileRow(
                    title: "查看关注列表",
                    value: "\(store.followingVenues.count) 家泳馆",
                    symbol: "heart.circle.fill",
                    accent: AppTint.warning
                )
            }
            .buttonStyle(.plain)

            if let first = store.followingVenues.first {
                VStack(alignment: .leading, spacing: AppSpacing.sm) {
                    divider

                    Text("最近关注")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)

                    NavigationLink {
                        VenueDetailView(venue: first)
                    } label: {
                        TrendingRankingCard(venue: first, index: 1)
                    }
                    .buttonStyle(.plain)
                    .buttonStyle(AppPressableButtonStyle())
                }
            } else {
                EmptyStateCard(
                    symbol: "heart.slash",
                    title: "还没有关注泳馆",
                    message: "在地图或热度页进入泳馆详情后，可以把常去泳馆加入关注列表。"
                )
            }
        }
        .appEntrance(isVisible: hasAnimatedIn, delay: 0.13)
    }

    private var signOutSection: some View {
        Button {
            Task { await signOut() }
        } label: {
            HStack {
                Text(isSigningOut ? "退出中..." : "退出登录")
                    .font(.headline.weight(.semibold))
                Spacer()
                Image(systemName: "arrow.right")
                    .font(.subheadline.weight(.bold))
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.horizontal, AppSpacing.md)
            .padding(.vertical, 20)
            .background(AppTint.warning)
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
            .shadow(color: AppTint.warning.opacity(0.18), radius: 18, x: 0, y: 12)
        }
        .buttonStyle(.plain)
        .buttonStyle(AppPressableButtonStyle())
        .disabled(isSigningOut)
        .appEntrance(isVisible: hasAnimatedIn, delay: 0.23)
    }

    private func heroPill(symbol: String, text: String) -> some View {
        Label(text, systemImage: symbol)
            .font(.caption.weight(.semibold))
            .foregroundStyle(.white)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Color.white.opacity(0.12))
            .clipShape(Capsule())
    }

    private func statTile(title: String, value: String, symbol: String, accent: Color) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Image(systemName: symbol)
                .font(.caption.weight(.bold))
                .foregroundStyle(accent)
                .frame(width: 28, height: 28)
                .background(accent.opacity(0.12))
                .clipShape(Circle())

            Spacer(minLength: 8)

            Text(value)
                .font(.title3.weight(.bold))
                .lineLimit(1)
                .minimumScaleFactor(0.7)

            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .frame(height: 128)
        .padding(.vertical, AppSpacing.md)
        .padding(.horizontal, AppSpacing.md)
        .background(
            RoundedRectangle(cornerRadius: 26, style: .continuous)
                .fill(Color.white.opacity(0.54))
                .background(
                    .ultraThinMaterial,
                    in: RoundedRectangle(cornerRadius: 26, style: .continuous)
                )
        )
        .overlay(
            RoundedRectangle(cornerRadius: 26, style: .continuous)
                .stroke(Color.white.opacity(0.74), lineWidth: 1)
        )
        .shadow(color: accent.opacity(0.10), radius: 16, x: 0, y: 12)
    }

    private func sectionCard<Content: View>(
        title: String,
        subtitle: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: AppSpacing.md) {
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.headline)
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            content()
        }
        .appCardStyle()
    }

    private var divider: some View {
        Rectangle()
            .fill(Color.white.opacity(0.75))
            .frame(height: 1)
    }

    private func profileRow(
        title: String,
        value: String,
        symbol: String,
        accent: Color,
        showsChevron: Bool = true
    ) -> some View {
        HStack(spacing: AppSpacing.md) {
            Image(systemName: symbol)
                .font(.headline)
                .foregroundStyle(.white)
                .frame(width: 40, height: 40)
                .background(
                    LinearGradient(
                        colors: [accent, accent.opacity(0.78)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                Text(value)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            if showsChevron {
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.tertiary)
            }
        }
        .padding(.vertical, 2)
    }

    private func updateAvatar(using item: PhotosPickerItem) async {
        isUpdatingAvatar = true
        defer {
            isUpdatingAvatar = false
            selectedPhoto = nil
        }

        do {
            let selectedData = try await item.loadTransferable(type: Data.self)
            let uploadData = selectedData.flatMap { data in
                UIImage(data: data)?.jpegData(compressionQuality: 0.86) ?? data
            }

            try await store.updateAvatar(data: uploadData)
            guard uploadData != nil else { return }

            withAnimation(AppMotion.emphasis) {
                showAvatarUpdatedToast = true
            }
            try? await Task.sleep(for: .seconds(1.8))
            withAnimation(AppMotion.quick) {
                showAvatarUpdatedToast = false
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func signOut() async {
        isSigningOut = true
        defer { isSigningOut = false }
        await store.signOut()
    }
}

private struct UserAvatarView: View {
    let user: AppUser?
    var size: CGFloat = 72

    var body: some View {
        Group {
            if let avatarURLString = user?.avatarURL, let avatarURL = URL(string: avatarURLString) {
                AsyncImage(url: avatarURL) { phase in
                    switch phase {
                    case let .success(image):
                        image
                            .resizable()
                            .scaledToFill()
                    case .empty:
                        ProgressView()
                            .controlSize(.small)
                    case .failure:
                        avatarFallback
                    @unknown default:
                        avatarFallback
                    }
                }
            } else if
                let data = user?.avatarData,
                let uiImage = UIImage(data: data)
            {
                Image(uiImage: uiImage)
                    .resizable()
                    .scaledToFill()
            } else {
                avatarFallback
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
        .overlay(
            Circle()
                .stroke(Color.white.opacity(0.92), lineWidth: 3)
        )
        .shadow(color: AppTint.primary.opacity(0.20), radius: 20, x: 0, y: 12)
    }

    private var avatarFallback: some View {
        ZStack {
            Circle()
                .fill(AppGradient.ocean)

            Text(user?.initials ?? "泳")
                .font(.system(size: size * 0.36, weight: .bold, design: .rounded))
                .foregroundStyle(.white)
        }
    }
}

struct FollowingVenuesView: View {
    @EnvironmentObject private var store: SwimAppStore

    var body: some View {
        ZStack(alignment: .top) {
            Color(.systemGroupedBackground).ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: AppSpacing.md) {
                    if store.followingVenues.isEmpty {
                        EmptyStateCard(
                            symbol: "heart.slash",
                            title: "还没有关注泳馆",
                            message: "在详情页点击关注后，这里会自动聚合你的常用泳馆。"
                        )
                    } else {
                        ForEach(Array(store.followingVenues.enumerated()), id: \.element.id) { index, venue in
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
        }
        .scrollIndicators(.hidden)
        .navigationTitle("我的关注")
        .navigationBarTitleDisplayMode(.inline)
        .appNavigationChrome()
    }
}

struct QuickEditNicknameSheet: View {
    @EnvironmentObject private var store: SwimAppStore
    @Environment(\.dismiss) private var dismiss

    @State private var nickname = ""
    @State private var isLoading = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: AppSpacing.lg) {
                VStack(alignment: .leading, spacing: AppSpacing.sm) {
                    Text("修改昵称")
                        .font(.title3.weight(.bold))

                    Text("更新后会立即同步到“我的”页面。")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                TextField("输入新的昵称", text: $nickname)
                    .textFieldStyle(.plain)
                    .font(.body)
                    .padding(.horizontal, AppSpacing.md)
                    .padding(.vertical, 14)
                    .background(Color(.tertiarySystemBackground).opacity(0.9))
                    .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))

                Spacer(minLength: 0)
            }
            .padding(AppSpacing.lg)
            .background(Color(.systemGroupedBackground))
            .navigationTitle("编辑昵称")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("取消") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .topBarTrailing) {
                    Button(isLoading ? "保存中..." : "保存") {
                        Task { await saveNickname() }
                    }
                    .disabled(isLoading || nickname.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
        }
        .presentationDetents([.height(250)])
        .presentationDragIndicator(.visible)
        .appDismissKeyboardOnTap()
        .alert("提示", isPresented: errorBinding) {
            Button("知道了", role: .cancel) {}
        } message: {
            Text(errorMessage ?? "")
        }
        .onAppear {
            nickname = store.currentUser?.nickname ?? ""
        }
    }

    private var errorBinding: Binding<Bool> {
        Binding(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )
    }

    private func saveNickname() async {
        isLoading = true
        defer { isLoading = false }

        do {
            try await store.updateNickname(nickname)
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

struct EditNicknameView: View {
    @EnvironmentObject private var store: SwimAppStore
    @Environment(\.dismiss) private var dismiss

    @State private var nickname = ""
    @State private var isLoading = false
    @State private var errorMessage: String?

    var body: some View {
        AccountFormScaffold(
            title: "修改昵称",
            subtitle: "让你的资料卡展示更贴近真实身份。",
            symbol: "person.text.rectangle.fill",
            accent: AppTint.primary
        ) {
            AccountFormCard(title: "昵称", subtitle: "公开展示信息") {
                VStack(alignment: .leading, spacing: AppSpacing.sm) {
                    formFieldTitle("新的昵称")
                    TextField("输入新的昵称", text: $nickname)
                        .textFieldStyle(.plain)
                        .font(.body)
                        .padding(.horizontal, AppSpacing.md)
                        .padding(.vertical, 14)
                        .background(Color(.tertiarySystemBackground).opacity(0.82))
                        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                }
            }

            AccountFormCard(title: "保存修改", subtitle: "昵称会立即同步到个人中心") {
                Button(isLoading ? "保存中..." : "保存昵称") {
                    Task { await saveNickname() }
                }
                .buttonStyle(.borderedProminent)
                .buttonStyle(AppPressableButtonStyle())
                .tint(AppTint.primary)
                .controlSize(.large)
                .disabled(isLoading || nickname.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .alert("提示", isPresented: errorBinding) {
            Button("知道了", role: .cancel) {}
        } message: {
            Text(errorMessage ?? "")
        }
        .onAppear {
            nickname = store.currentUser?.nickname ?? ""
        }
    }

    private var errorBinding: Binding<Bool> {
        Binding(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )
    }

    private func saveNickname() async {
        isLoading = true
        defer { isLoading = false }

        do {
            try await store.updateNickname(nickname)
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

struct ChangeEmailView: View {
    @EnvironmentObject private var store: SwimAppStore
    @Environment(\.dismiss) private var dismiss

    @State private var newEmail = ""
    @State private var code = ""
    @State private var hasSentCode = false
    @State private var isLoading = false
    @State private var errorMessage: String?

    var body: some View {
        AccountFormScaffold(
            title: "修改邮箱",
            subtitle: "新的邮箱需要先完成验证码校验，确保账号安全。",
            symbol: "at.circle.fill",
            accent: AppTint.primary
        ) {
            AccountFormCard(title: "新邮箱", subtitle: "接收验证码与后续通知") {
                VStack(alignment: .leading, spacing: AppSpacing.sm) {
                    formFieldTitle("邮箱地址")
                    TextField("输入新的邮箱地址", text: $newEmail)
                        .textInputAutocapitalization(.never)
                        .keyboardType(.emailAddress)
                        .autocorrectionDisabled()
                        .textFieldStyle(.plain)
                        .font(.body)
                        .padding(.horizontal, AppSpacing.md)
                        .padding(.vertical, 14)
                        .background(Color(.tertiarySystemBackground).opacity(0.82))
                        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))

                    Button(isLoading ? "发送中..." : "发送验证码") {
                        Task { await sendCode() }
                    }
                    .buttonStyle(.borderedProminent)
                    .buttonStyle(AppPressableButtonStyle())
                    .tint(AppTint.primary)
                    .controlSize(.large)
                    .disabled(isLoading || newEmail.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)

                }
            }

            if hasSentCode {
                AccountFormCard(title: "验证码", subtitle: "校验通过后立即替换当前邮箱") {
                    VStack(alignment: .leading, spacing: AppSpacing.sm) {
                        formFieldTitle("6 位验证码")
                        TextField("输入 6 位验证码", text: $code)
                            .textFieldStyle(.plain)
                            .font(.body)
                            .padding(.horizontal, AppSpacing.md)
                            .padding(.vertical, 14)
                            .background(Color(.tertiarySystemBackground).opacity(0.82))
                            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))

                        Button(isLoading ? "提交中..." : "确认修改邮箱") {
                            Task { await confirmChange() }
                        }
                        .buttonStyle(.borderedProminent)
                        .buttonStyle(AppPressableButtonStyle())
                        .tint(AppTint.primary)
                        .controlSize(.large)
                        .disabled(isLoading || code.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    }
                }
            }
        }
        .alert("提示", isPresented: errorBinding) {
            Button("知道了", role: .cancel) {}
        } message: {
            Text(errorMessage ?? "")
        }
    }

    private var errorBinding: Binding<Bool> {
        Binding(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )
    }

    private func sendCode() async {
        isLoading = true
        defer { isLoading = false }

        do {
            try await store.sendChangeEmailCode(to: newEmail)
            hasSentCode = true
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func confirmChange() async {
        isLoading = true
        defer { isLoading = false }

        do {
            try await store.confirmChangeEmail(to: newEmail, code: code)
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

struct ChangePasswordView: View {
    @EnvironmentObject private var store: SwimAppStore

    @State private var code = ""
    @State private var newPassword = ""
    @State private var confirmPassword = ""
    @State private var hasSentCode = false
    @State private var isCodeVerified = false
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var toastMessage: String?
    @State private var toastStyle: InlineStatusToastStyle = .success

    var body: some View {
        AccountFormScaffold(
            title: "修改密码",
            subtitle: "",
            symbol: "lock.fill",
            accent: AppTint.indigo,
            showHero: false
        ) {
            VStack(spacing: AppSpacing.md) {
                AccountFormCard(title: "引导说明", subtitle: "按步骤完成密码修改") {
                    stepIndicator(
                        items: [
                            ("验证码", true),
                            ("新密码", isCodeVerified)
                        ]
                    )
                }

                if !isCodeVerified {
                    AccountFormCard(title: "验证码", subtitle: "先发送验证码，再完成验证码校验") {
                        VStack(alignment: .leading, spacing: AppSpacing.sm) {
                            if let currentEmail = store.currentUser?.email {
                                formFieldTitle("当前邮箱")
                                infoPill(symbol: "envelope.fill", text: currentEmail)
                            }

                            formFieldTitle("验证码")
                            TextField("输入 6 位验证码", text: $code)
                                .textFieldStyle(.plain)
                                .font(.body)
                                .padding(.horizontal, AppSpacing.md)
                                .padding(.vertical, 14)
                                .background(Color(.tertiarySystemBackground).opacity(0.82))
                                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))

                            Button(isLoading ? "处理中..." : verificationButtonTitle) {
                                Task { await handleVerificationAction() }
                            }
                            .buttonStyle(.borderedProminent)
                            .buttonStyle(AppPressableButtonStyle())
                            .tint(AppTint.indigo)
                            .controlSize(.large)
                            .disabled(
                                isLoading
                                    || (hasSentCode && code.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                            )
                        }
                    }
                }

                if isCodeVerified {
                    AccountFormCard(title: "新密码", subtitle: "") {
                        VStack(alignment: .leading, spacing: AppSpacing.sm) {
                            formFieldTitle("新密码")
                            SecureField("输入新密码", text: $newPassword)
                                .textFieldStyle(.plain)
                                .font(.body)
                                .padding(.horizontal, AppSpacing.md)
                                .padding(.vertical, 14)
                                .background(Color(.tertiarySystemBackground).opacity(0.82))
                                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))

                            Text("8-20位，且至少包含字母和数字")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .padding(.leading, AppSpacing.md)

                            formFieldTitle("确认密码")
                            SecureField("再次输入新密码", text: $confirmPassword)
                                .textFieldStyle(.plain)
                                .font(.body)
                                .padding(.horizontal, AppSpacing.md)
                                .padding(.vertical, 14)
                                .background(Color(.tertiarySystemBackground).opacity(0.82))
                                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))

                            Text("8-20位，且至少包含字母和数字")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .padding(.leading, AppSpacing.md)

                            Button(isLoading ? "处理中..." : "确认") {
                                Task { await confirmChange() }
                            }
                            .buttonStyle(.borderedProminent)
                            .buttonStyle(AppPressableButtonStyle())
                            .tint(AppTint.indigo)
                            .controlSize(.large)
                            .disabled(
                                isLoading
                                    || newPassword.isEmpty
                                    || confirmPassword.isEmpty
                            )
                        }
                    }
                }
            }
        }
        .alert("提示", isPresented: errorBinding) {
            Button("知道了", role: .cancel) {}
        } message: {
            Text(errorMessage ?? "")
        }
        .overlay(alignment: .top) {
            if let toastMessage {
                InlineStatusToast(message: toastMessage, style: toastStyle)
                    .padding(.top, 8)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
    }

    private var errorBinding: Binding<Bool> {
        Binding(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )
    }

    private var verificationButtonTitle: String {
        hasSentCode ? "验证" : "发送"
    }

    private func handleVerificationAction() async {
        if hasSentCode {
            await verifyCode()
        } else {
            await sendCode()
        }
    }

    private func sendCode() async {
        isLoading = true
        defer { isLoading = false }

        do {
            try await store.sendChangePasswordCode()
            hasSentCode = true
            isCodeVerified = false
            code = ""
            newPassword = ""
            confirmPassword = ""
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func verifyCode() async {
        isLoading = true
        defer { isLoading = false }

        do {
            try await store.verifyChangePasswordCode(code)
            isCodeVerified = true
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func confirmChange() async {
        guard newPassword == confirmPassword else {
            errorMessage = "两次输入的新密码不一致。"
            return
        }

        isLoading = true
        defer { isLoading = false }

        do {
            try await store.confirmChangePassword(code: code, newPassword: newPassword)
            showToast("修改成功，重新登录", style: .success)
            try? await Task.sleep(for: .seconds(1.1))
            await store.signOut()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func showToast(_ message: String, style: InlineStatusToastStyle) {
        withAnimation(AppMotion.emphasis) {
            toastMessage = message
            toastStyle = style
        }

        Task {
            try? await Task.sleep(for: .seconds(1.8))
            await MainActor.run {
                guard toastMessage == message else { return }
                withAnimation(AppMotion.quick) {
                    toastMessage = nil
                }
            }
        }
    }
}

private func stepIndicator(items: [(String, Bool)]) -> some View {
    HStack(spacing: AppSpacing.sm) {
        ForEach(Array(items.enumerated()), id: \.offset) { index, item in
            VStack(spacing: 8) {
                Image(systemName: item.1 ? "checkmark.circle.fill" : "circle")
                    .foregroundStyle(item.1 ? AppTint.primary : Color.secondary.opacity(0.45))
                    .font(.title3.weight(.semibold))

                Text(item.0)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(item.1 ? Color.primary : Color.secondary)
                    .multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity)
            .padding(.horizontal, 8)
            .padding(.vertical, 10)
            .background(Color(.secondarySystemBackground).opacity(0.9))
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))

            if index < items.count - 1 {
                Rectangle()
                    .fill(Color.white.opacity(0.85))
                    .frame(maxWidth: 28)
                    .frame(height: 1)
            }
        }
    }
    .padding(.horizontal, 4)
}

private struct AccountFormScaffold<Content: View>: View {
    let title: String
    let subtitle: String
    let symbol: String
    let accent: Color
    let showHero: Bool
    @ViewBuilder let content: () -> Content

    init(
        title: String,
        subtitle: String,
        symbol: String,
        accent: Color,
        showHero: Bool = true,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.title = title
        self.subtitle = subtitle
        self.symbol = symbol
        self.accent = accent
        self.showHero = showHero
        self.content = content
    }

    var body: some View {
        ZStack(alignment: .top) {
            Color(.systemGroupedBackground).ignoresSafeArea()

            LinearGradient(
                colors: [accent.opacity(0.14), Color.clear],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            ScrollView {
                VStack(spacing: AppSpacing.lg) {
                    if showHero {
                        hero
                    }
                    content()
                }
                .padding(.horizontal, AppSpacing.lg)
                .padding(.top, AppSpacing.md)
                .padding(.bottom, AppSpacing.xl)
            }
            .scrollIndicators(.hidden)
        }
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
        .appNavigationChrome()
        .appDismissKeyboardOnTap()
    }

    private var hero: some View {
        HStack(spacing: AppSpacing.md) {
            Image(systemName: symbol)
                .font(.title2.weight(.bold))
                .foregroundStyle(.white)
                .frame(width: 54, height: 54)
                .background(
                    LinearGradient(
                        colors: [accent, accent.opacity(0.76)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))

            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.title3.weight(.bold))
                if !subtitle.isEmpty {
                    Text(subtitle)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }

            Spacer()
        }
        .appCardStyle()
    }
}

private struct AccountFormCard<Content: View>: View {
    let title: String
    let subtitle: String
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.md) {
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.headline)
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            content()
        }
        .appCardStyle()
    }
}

private struct InlineSuccessToast: View {
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

private enum InlineStatusToastStyle {
    case success
    case error

    var symbol: String {
        switch self {
        case .success:
            return "checkmark.circle.fill"
        case .error:
            return "exclamationmark.circle.fill"
        }
    }

    var tint: Color {
        switch self {
        case .success:
            return AppTint.success
        case .error:
            return AppTint.warning
        }
    }
}

private struct InlineStatusToast: View {
    let message: String
    let style: InlineStatusToastStyle

    var body: some View {
        Label(message, systemImage: style.symbol)
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(style.tint)
            .padding(.horizontal, AppSpacing.md)
            .padding(.vertical, 12)
            .background(Color(.secondarySystemBackground).opacity(0.96))
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .stroke(Color.white.opacity(0.72), lineWidth: 1)
            )
            .shadow(color: style.tint.opacity(0.10), radius: 12, x: 0, y: 8)
    }
}

private func formFieldTitle(_ title: String) -> some View {
    Text(title)
        .font(.caption.weight(.semibold))
        .foregroundStyle(.secondary)
}

private func infoPill(symbol: String, text: String) -> some View {
    Label(text, systemImage: symbol)
        .font(.caption.weight(.medium))
        .foregroundStyle(.secondary)
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(Color(.tertiarySystemBackground).opacity(0.82))
        .clipShape(Capsule())
}
