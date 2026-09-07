import SwiftUI

private func authErrorMessage(from error: Error) -> String {
    if let localizedError = error as? LocalizedError,
       let description = localizedError.errorDescription,
       !description.isEmpty {
        return description
    }

    let description = error.localizedDescription.trimmingCharacters(in: .whitespacesAndNewlines)
    if !description.isEmpty, description != "The operation couldn’t be completed." {
        return description
    }

    return "请求失败，请稍后再试。"
}

private enum AuthRoute: Hashable {
    case firstLogin
    case passwordLogin
}

struct AuthFlowView: View {
    @State private var path: [AuthRoute] = []

    var body: some View {
        NavigationStack(path: $path) {
            ZStack {
                authLandingBackground

                ScrollView {
                    VStack(spacing: AppSpacing.xl) {
                        Spacer(minLength: 40)
                        heroSection
                        actionSection
                        Spacer(minLength: 20)
                    }
                    .frame(maxWidth: .infinity, minHeight: UIScreen.main.bounds.height - 80)
                    .padding(.horizontal, AppSpacing.lg)
                    .padding(.top, AppSpacing.xl)
                    .padding(.bottom, AppSpacing.xl)
                }
            }
            .background(Color(.systemGroupedBackground))
            .navigationBarHidden(true)
            .navigationDestination(for: AuthRoute.self) { route in
                switch route {
                case .firstLogin:
                    FirstLoginView()
                case .passwordLogin:
                    PasswordLoginView()
                }
            }
        }
    }

    private var authLandingBackground: some View {
        ZStack {
            Color(.systemGroupedBackground)

            Circle()
                .fill(AppTint.primary.opacity(0.14))
                .frame(width: 320, height: 320)
                .blur(radius: 54)
                .offset(x: -120, y: -220)

            Circle()
                .fill(AppTint.cyan.opacity(0.12))
                .frame(width: 240, height: 240)
                .blur(radius: 42)
                .offset(x: 130, y: -80)
        }
        .ignoresSafeArea()
    }

    private var heroSection: some View {
        VStack(spacing: AppSpacing.md) {
            ZStack {
                RoundedRectangle(cornerRadius: 32, style: .continuous)
                    .fill(AppGradient.ocean)
                    .frame(width: 88, height: 88)

                Circle()
                    .fill(Color.white.opacity(0.14))
                    .frame(width: 60, height: 60)
                    .offset(x: 18, y: -18)

                Image(systemName: "drop.fill")
                    .font(.system(size: 30, weight: .bold))
                    .foregroundStyle(.white)
            }
            .shadow(color: AppTint.primary.opacity(0.20), radius: 22, x: 0, y: 14)

            Text("泳池水质通")
                .font(.system(size: 30, weight: .bold, design: .rounded))
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 38)
    }

    private var actionSection: some View {
        VStack(spacing: AppSpacing.md) {
            VStack(spacing: AppSpacing.sm) {
                Text("已有账号")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)

                Button {
                    path.append(.passwordLogin)
                } label: {
                    HStack {
                        Text("登录")
                            .font(.headline.weight(.semibold))
                        Spacer()
                        Image(systemName: "arrow.right")
                            .font(.subheadline.weight(.bold))
                    }
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.horizontal, AppSpacing.md)
                    .padding(.vertical, 18)
                    .background(AppGradient.ocean)
                    .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                }
                .buttonStyle(.plain)
                .buttonStyle(AppPressableButtonStyle())
            }
            .appCardStyle()

            VStack(spacing: AppSpacing.sm) {
                Text("新用户")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)

                Button {
                    path.append(.firstLogin)
                } label: {
                    HStack {
                        Text("注册")
                            .font(.headline.weight(.semibold))
                        Spacer()
                        Image(systemName: "arrow.right")
                            .font(.subheadline.weight(.bold))
                    }
                    .foregroundStyle(.primary)
                    .frame(maxWidth: .infinity)
                    .padding(.horizontal, AppSpacing.md)
                    .padding(.vertical, 18)
                    .background(Color(.tertiarySystemBackground).opacity(0.92))
                    .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                }
                .buttonStyle(.plain)
                .buttonStyle(AppPressableButtonStyle())
            }
            .appCardStyle()

            Text("注册或登录后继续")
                .font(.caption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: 420)
        .frame(maxWidth: .infinity)
        .padding(.top, AppSpacing.sm)
    }
}

struct FirstLoginView: View {
    @EnvironmentObject private var store: SwimAppStore
    @Environment(\.dismiss) private var dismiss
    @FocusState private var focusedField: RegistrationField?

    @State private var email = ""
    @State private var code = ""
    @State private var password = ""
    @State private var confirmPassword = ""
    @State private var hasSentCode = false
    @State private var isCodeVerified = false
    @State private var isLoading = false
    @State private var errorMessage: String?

    private enum RegistrationField: Hashable {
        case email
        case code
        case password
        case confirmPassword
    }

    var body: some View {
        ZStack {
            Color(.systemGroupedBackground).ignoresSafeArea()

            LinearGradient(
                colors: [AppTint.primary.opacity(0.14), Color.clear],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            VStack {
                Spacer()

                VStack(spacing: AppSpacing.lg) {
                    AuthFormCard(title: "引导说明", subtitle: "按步骤完成首次注册") {
                        stepIndicator(
                            items: [
                                ("填邮箱", true),
                                ("验证码", hasSentCode),
                                ("设密码", isCodeVerified)
                            ]
                        )
                    }

                    if !isCodeVerified {
                        AuthFormCard(title: "邮箱", subtitle: "先确认你的注册邮箱") {
                            VStack(alignment: .leading, spacing: AppSpacing.sm) {
                                authFieldTitle("邮箱地址")
                                TextField("输入邮箱地址", text: $email)
                                    .textInputAutocapitalization(.never)
                                    .keyboardType(.emailAddress)
                                    .autocorrectionDisabled()
                                    .textFieldStyle(.plain)
                                    .font(.body)
                                    .focused($focusedField, equals: .email)
                                    .padding(.horizontal, AppSpacing.md)
                                    .padding(.vertical, 14)
                                    .background(Color(.tertiarySystemBackground).opacity(0.82))
                                    .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))

                                if !hasSentCode {
                                    Button(isLoading ? "发送中..." : "发送验证码") {
                                        Task { await sendCode() }
                                    }
                                    .buttonStyle(.borderedProminent)
                                    .buttonStyle(AppPressableButtonStyle())
                                    .tint(AppTint.primary)
                                    .controlSize(.large)
                                    .disabled(isLoading || email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                                }

                            }
                        }
                    }

                    if hasSentCode && !isCodeVerified {
                        AuthFormCard(title: "验证码", subtitle: "完成邮箱验证后才能设置密码") {
                            VStack(alignment: .leading, spacing: AppSpacing.sm) {
                                authFieldTitle("6 位验证码")
                                TextField("输入 6 位验证码", text: $code)
                                    .textFieldStyle(.plain)
                                    .font(.body)
                                    .focused($focusedField, equals: .code)
                                    .padding(.horizontal, AppSpacing.md)
                                    .padding(.vertical, 14)
                                    .background(Color(.tertiarySystemBackground).opacity(0.82))
                                    .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                                    .onSubmit {
                                        focusedField = nil
                                    }

                                Button(isLoading ? "校验中..." : "验证邮箱") {
                                    Task { await verifyCode() }
                                }
                                .buttonStyle(.borderedProminent)
                                .buttonStyle(AppPressableButtonStyle())
                                .tint(AppTint.primary)
                                .controlSize(.large)
                                .disabled(isLoading || code.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                            }
                        }
                    }

                    if isCodeVerified {
                        AuthFormCard(title: "设置密码", subtitle: "后续登录将直接使用邮箱和密码") {
                            VStack(alignment: .leading, spacing: AppSpacing.sm) {
                                authFieldTitle("新密码")
                                SecureField("设置密码", text: $password)
                                    .textFieldStyle(.plain)
                                    .font(.body)
                                    .focused($focusedField, equals: .password)
                                    .padding(.horizontal, AppSpacing.md)
                                    .padding(.vertical, 14)
                                    .background(Color(.tertiarySystemBackground).opacity(0.82))
                                    .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))

                                authInfoPill(symbol: "lock.shield.fill", text: "密码需为 8-20 位，且至少包含字母和数字")

                                authFieldTitle("确认密码")
                                SecureField("再次输入密码", text: $confirmPassword)
                                    .textFieldStyle(.plain)
                                    .font(.body)
                                    .focused($focusedField, equals: .confirmPassword)
                                    .padding(.horizontal, AppSpacing.md)
                                    .padding(.vertical, 14)
                                    .background(Color(.tertiarySystemBackground).opacity(0.82))
                                    .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))

                                authInfoPill(symbol: "lock.shield.fill", text: "密码需为 8-20 位，且至少包含字母和数字")

                                Button(isLoading ? "创建中..." : "完成") {
                                    Task { await finishFirstLogin() }
                                }
                                .buttonStyle(.borderedProminent)
                                .buttonStyle(AppPressableButtonStyle())
                                .tint(AppTint.primary)
                                .controlSize(.large)
                                .disabled(isLoading || password.isEmpty || confirmPassword.isEmpty)
                            }
                        }
                    }
                }
                .frame(maxWidth: 420)
                .padding(.horizontal, AppSpacing.lg)

                Spacer()
            }
        }
        .appDismissKeyboardOnTap()
        .navigationTitle("注册页")
        .navigationBarTitleDisplayMode(.inline)
        .appNavigationChrome()
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
        focusedField = nil
        isLoading = true
        defer { isLoading = false }

        do {
            NSLog("[AuthDebug] FirstLoginView.sendCode tapped, email=%@", email)
            try await store.sendFirstLoginCode(to: email)
            hasSentCode = true
            focusedField = .code
        } catch {
            NSLog("[AuthDebug] FirstLoginView.sendCode failed: %@", String(describing: error))
            errorMessage = authErrorMessage(from: error)
        }
    }

    private func verifyCode() async {
        focusedField = nil
        isLoading = true
        defer { isLoading = false }

        do {
            try await store.verifyFirstLoginCode(email: email, code: code)
            isCodeVerified = true
            focusedField = .password
        } catch {
            errorMessage = authErrorMessage(from: error)
        }
    }

    private func finishFirstLogin() async {
        guard password == confirmPassword else {
            errorMessage = "两次输入的密码不一致。"
            return
        }

        isLoading = true
        defer { isLoading = false }

        do {
            try await store.completeFirstLogin(email: email, password: password)
        } catch {
            errorMessage = authErrorMessage(from: error)
        }
    }
}

struct PasswordLoginView: View {
    @EnvironmentObject private var store: SwimAppStore
    @Environment(\.dismiss) private var dismiss

    @State private var email = ""
    @State private var password = ""
    @State private var isLoading = false
    @State private var errorMessage: String?

    var body: some View {
        ZStack {
            Color(.systemGroupedBackground).ignoresSafeArea()

            LinearGradient(
                colors: [AppTint.indigo.opacity(0.14), Color.clear],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            VStack {
                Spacer()

                AuthFormCard(title: "账号登录", subtitle: "输入邮箱和密码继续") {
                    VStack(alignment: .leading, spacing: AppSpacing.sm) {
                        authFieldTitle("邮箱地址")
                        TextField("输入邮箱地址", text: $email)
                            .textInputAutocapitalization(.never)
                            .keyboardType(.emailAddress)
                            .autocorrectionDisabled()
                            .textFieldStyle(.plain)
                            .font(.body)
                            .padding(.horizontal, AppSpacing.md)
                            .padding(.vertical, 14)
                            .background(Color(.tertiarySystemBackground).opacity(0.82))
                            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))

                        authFieldTitle("登录密码")
                        SecureField("输入密码", text: $password)
                            .textFieldStyle(.plain)
                            .font(.body)
                            .padding(.horizontal, AppSpacing.md)
                            .padding(.vertical, 14)
                            .background(Color(.tertiarySystemBackground).opacity(0.82))
                            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))

                        Button(isLoading ? "登录中..." : "登录") {
                            Task { await login() }
                        }
                        .buttonStyle(.borderedProminent)
                        .buttonStyle(AppPressableButtonStyle())
                        .tint(AppTint.indigo)
                        .controlSize(.large)
                        .disabled(isLoading || email.isEmpty || password.isEmpty)
                    }
                }
                .frame(maxWidth: 420)
                .padding(.horizontal, AppSpacing.lg)

                Spacer()
            }
        }
        .appDismissKeyboardOnTap()
        .navigationTitle("登录页")
        .navigationBarTitleDisplayMode(.inline)
        .appNavigationChrome()
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

    private func login() async {
        isLoading = true
        defer { isLoading = false }

        do {
            try await store.login(email: email, password: password)
        } catch {
            errorMessage = authErrorMessage(from: error)
        }
    }
}

private struct AuthFormScaffold<Content: View>: View {
    let title: String
    let subtitle: String
    let symbol: String
    let accent: Color
    @ViewBuilder let content: () -> Content

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
                    hero
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
    }

    private var hero: some View {
        HStack(spacing: AppSpacing.md) {
            Image(systemName: symbol)
                .font(.title2.weight(.bold))
                .foregroundStyle(.white)
                .frame(width: 56, height: 56)
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
                Text(subtitle)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Spacer()
        }
        .appCardStyle()
    }
}

private struct AuthFormCard<Content: View>: View {
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

private struct AuthSuccessToast: View {
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

private func authFieldTitle(_ title: String) -> some View {
    Text(title)
        .font(.caption.weight(.semibold))
        .foregroundStyle(.secondary)
}

private func authInfoPill(symbol: String, text: String) -> some View {
    Label(text, systemImage: symbol)
        .font(.caption.weight(.medium))
        .foregroundStyle(.secondary)
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(Color(.tertiarySystemBackground).opacity(0.82))
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
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
