import MapKit
import SwiftUI
import UIKit

private struct SearchResultsPresentation: Identifiable {
    let id = UUID()
    let keyword: String
    let results: [SwimVenue]
}

struct TrainingView: View {
    @Binding var selectedTab: AppTab

    @EnvironmentObject private var store: SwimAppStore
    @Environment(\.openURL) private var openURL
    @Namespace private var mapScope

    @State private var path: [SwimVenue] = []
    @State private var searchText = ""
    @State private var searchResults: [SwimVenue] = []
    @State private var submittedSearchText = ""
    @State private var selectedVenueID: String?
    @State private var searchPresentation: SearchResultsPresentation?
    @State private var searchSheetDetent: PresentationDetent = .medium
    @State private var isSearchFocused = false

    private var trimmedSearchText: String {
        searchText.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var body: some View {
        NavigationStack(path: $path) {
            ZStack(alignment: .top) {
                fullScreenMap

                VStack(spacing: AppSpacing.md) {
                    searchBar
                }
                .padding(.horizontal, AppSpacing.lg)
                .padding(.top, AppSpacing.md)
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("地图")
            .navigationBarTitleDisplayMode(.inline)
            .navigationDestination(for: SwimVenue.self) { venue in
                VenueDetailView(venue: venue)
            }
            .appNavigationChrome()
            .alert("定位权限未开启", isPresented: $store.locationPermissionDenied) {
                Button("暂不", role: .cancel) {
                    store.dismissLocationPermissionAlert()
                }
                Button("去设置") {
                    if let settingsURL = URL(string: UIApplication.openSettingsURLString) {
                        openURL(settingsURL)
                    }
                    store.dismissLocationPermissionAlert()
                }
            } message: {
                Text("请允许访问设备定位，用于展示你附近的泳池、显示当前位置，并支持一键回到你所在位置。")
            }
            .onAppear {
                if store.locationAuthorizationStatus == .notDetermined || store.userLocation == nil {
                    store.requestCurrentLocation(focusMap: false)
                } else {
                    store.syncMapCurrentCityToUserLocation()
                }
            }
            .onChange(of: store.userLocation) { _, newValue in
                guard newValue != nil else { return }
                store.syncMapCurrentCityToUserLocation()
            }
            .onChange(of: searchText) { _, newValue in
                let trimmed = newValue.trimmingCharacters(in: .whitespacesAndNewlines)
                if trimmed.isEmpty {
                    submittedSearchText = ""
                    searchResults = []
                    searchPresentation = nil
                } else if trimmed != submittedSearchText {
                    searchPresentation = nil
                }
            }
            .onChange(of: store.currentCity) { _, _ in
                guard !submittedSearchText.isEmpty else { return }
                updateSearchResults(for: submittedSearchText)
            }
            .onChange(of: selectedVenueID) { _, newValue in
                guard let newValue,
                      let venue = store.cityVenues.first(where: { $0.id == newValue }) else { return }
                isSearchFocused = false
                store.centerOnVenue(venue)
                path.append(venue)
                selectedVenueID = nil
            }
            .sheet(item: $searchPresentation) { presentation in
                searchResultsSheet(presentation: presentation)
                    .id("search-sheet-\(presentation.keyword)-\(presentation.results.count)")
            }
        }
    }

    private var fullScreenMap: some View {
        ZStack(alignment: .bottomTrailing) {
            Map(position: $store.cameraPosition, selection: $selectedVenueID, scope: mapScope) {
                UserAnnotation()

                ForEach(store.cityVenues) { venue in
                    Marker(venue.displayName, systemImage: markerSymbol(for: venue), coordinate: venue.coordinate)
                        .tint(markerTint(for: venue))
                        .tag(venue.id)
                }
            }
            .mapStyle(mapStyle)
            .mapControlVisibility(.hidden)
            .transaction { transaction in
                transaction.animation = nil
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .ignoresSafeArea(edges: .bottom)
            .simultaneousGesture(
                TapGesture().onEnded {
                    isSearchFocused = false
                }
            )

            VStack(spacing: 0) {
                HStack {
                    Spacer()
                    MapCompass(scope: mapScope)
                }
                .padding(.horizontal, AppSpacing.lg)
                .padding(.top, 6)

                Spacer()
            }
            .padding(.top, 30)
            .ignoresSafeArea(edges: .top)

            VStack(alignment: .trailing, spacing: AppSpacing.sm) {
//                dataSourceToggleCard

                Menu {
                    ForEach(MapDisplayMode.allCases) { mode in
                        Button(mode.title) {
                            store.mapDisplayMode = mode
                        }
                    }
                } label: {
                    floatingMapButton(systemImage: "square.2.layers.3d", title: store.mapDisplayMode.title)
                }

                Button {
                    store.requestCurrentLocation()
                } label: {
                    floatingMapButton(systemImage: "location.fill", title: "定位")
                }
            }
            .padding(.trailing, AppSpacing.lg)
            .padding(.bottom, 60)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
        .mapScope(mapScope)
    }

//    private var dataSourceToggleCard: some View {
//        VStack(alignment: .leading, spacing: AppSpacing.sm) {
//            HStack(spacing: AppSpacing.sm) {
//                VStack(alignment: .leading, spacing: 2) {
//                    Label {
//                        Text(store.dataSourceMode == .realtime ? "实时数据" : "人工数据")
//                            .font(.subheadline.weight(.semibold))
//                    } icon: {
//                        Image(systemName: store.dataSourceMode == .realtime
//                              ? "dot.radiowaves.forward"
//                              : "server.rack")
//                        .font(.footnote.weight(.semibold))
//                    }
//                    Text(store.dataSourceMode.label)
//                        .font(.caption2)
//                        .foregroundStyle(.secondary)
//                }
//
//                Toggle(
//                    isOn: Binding(
//                        get: { store.dataSourceMode == .realtime },
//                        set: { isOn in
//                            let newMode: SwimAppStore.DataSourceMode = isOn ? .realtime : .manual
//                            guard newMode != store.dataSourceMode else { return }
//                            store.dataSourceMode = newMode
//                            store.reloadVenuesWithCurrentMode()
//                        }
//                    )
//                ) {
//                    EmptyView()
//                }
//                .labelsHidden()
//                .toggleStyle(.switch)
//                .tint(AppTint.primary)
//            }
//
////            if store.dataSourceMode == .realtime {
////                statusPill(for: store.lastRealtimeStatus)
////            }
//        }
//        .padding(.horizontal, AppSpacing.sm)
//        .padding(.vertical, 10)
//        .background(Color(.systemBackground).opacity(0.92))
//        .clipShape(Capsule())
//        .overlay(
//            Capsule()
//                .stroke(Color.white.opacity(0.7), lineWidth: 1)
//        )
//        .shadow(color: Color.black.opacity(0.05), radius: 8, x: 0, y: 4)
//    }
//
////    private func statusPill(for status: SwimAppStore.RealtimeFetchStatus) -> some View {
////        let (symbol, tint): (String, Color) = {
////            switch status {
////            case .idle: return ("checkmark.circle.fill", .secondary)
////            case .loading: return ("arrow.clockwise.circle.fill", .blue)
////            case .liveApplied: return ("checkmark.seal.fill", .green)
////            case .citySnapshotApplied: return ("exclamationmark.triangle.fill", .yellow)
////            case .fallbackManual: return ("exclamationmark.octagon.fill", .red)
////            case .rateLimited: return ("hourglass.tophalf.fill", .orange)
////            }
////        }()
////
////        return HStack(spacing: 6) {
////            Image(systemName: symbol)
////                .font(.caption2.weight(.semibold))
////                .foregroundStyle(tint)
////
////            VStack(alignment: .leading, spacing: 0) {
////                Text(status.title)
////                    .font(.caption.weight(.semibold))
////                Text(status.subtitle)
////                    .font(.caption2)
////                    .foregroundStyle(.secondary)
////                    .lineLimit(2)
////            }
////            Spacer(minLength: 0)
////        }
////        .padding(.horizontal, AppSpacing.sm)
////        .padding(.vertical, 6)
////        .background(Color(.secondarySystemBackground).opacity(0.72))
////        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
////    }

    private var searchBar: some View {
        HStack(spacing: AppSpacing.sm) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(.secondary)

            SearchSubmitTextField(
                text: $searchText,
                isFirstResponder: $isSearchFocused,
                placeholder: "搜索游泳馆名称"
            ) { submittedText in
                performSearch(using: submittedText)
            }
            .frame(height: 24)

            if !trimmedSearchText.isEmpty {
                Button {
                    searchText = ""
                    submittedSearchText = ""
                    searchResults = []
                    isSearchFocused = false
                    searchPresentation = nil
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, AppSpacing.md)
        .padding(.vertical, 14)
        .background(Color(.systemBackground).opacity(0.94))
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(
                    LinearGradient(
                        colors: [
                            Color.white.opacity(0.95),
                            AppTint.primary.opacity(0.36),
                            Color.white.opacity(0.72)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    lineWidth: 1.8
                )
        )
        .shadow(color: AppTint.primary.opacity(0.10), radius: 14, x: 0, y: 8)
        .padding(.top, 4)
    }

    private func searchResultsSheet(presentation: SearchResultsPresentation) -> some View {
        VStack(alignment: .leading, spacing: AppSpacing.md) {
            HStack {
                Text("搜索结果")
                    .font(.headline)
                Spacer()
                Text(listSubtitle(for: presentation.results.count))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            if presentation.results.isEmpty {
                EmptyStateCard(
                    symbol: "magnifyingglass",
                    title: "没有找到匹配泳馆",
                    message: "试试输入其他泳馆名称继续搜索。"
                )
            } else {
                ScrollView {
                    VStack(spacing: AppSpacing.md) {
                        ForEach(presentation.results) { venue in
                            Button {
                                openVenueFromSearch(venue)
                            } label: {
                                VenueListCardView(
                                    venue: venue,
                                    followerCount: store.followerCount(for: venue),
                                    distanceText: store.distanceText(for: venue)
                                )
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.bottom, AppSpacing.xl)
                }
                .scrollIndicators(.hidden)
            }
        }
        .padding(AppSpacing.lg)
        .presentationDetents([.medium, .large], selection: $searchSheetDetent)
        .presentationDragIndicator(.visible)
    }

    private var mapStyle: MapStyle {
        switch store.mapDisplayMode {
        case .standard:
            return .standard
        case .hybrid:
            return .hybrid
        case .imagery:
            return .imagery
        }
    }

    private func listSubtitle(for count: Int) -> String {
        return "\(count) 条匹配"
    }

    private func openVenueFromSearch(_ venue: SwimVenue) {
        isSearchFocused = false
        searchPresentation = nil
        store.centerOnVenue(venue)
        DispatchQueue.main.async {
            path.append(venue)
        }
    }

    private func performSearch(using keyword: String? = nil) {
        let trimmed = (keyword ?? searchText).trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            submittedSearchText = ""
            searchResults = []
            searchPresentation = nil
            return
        }

        submittedSearchText = trimmed
        let results = updateSearchResults(for: trimmed)
        isSearchFocused = false
        searchSheetDetent = .medium
        DispatchQueue.main.async {
            searchPresentation = SearchResultsPresentation(keyword: trimmed, results: results)
        }
    }

    @discardableResult
    private func updateSearchResults(for keyword: String) -> [SwimVenue] {
        let trimmed = keyword.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            searchResults = []
            return []
        }
        searchResults = store.filteredVenues(searchText: trimmed)
        return searchResults
    }

    private func markerSymbol(for venue: SwimVenue) -> String {
        store.isFollowed(venue.id) ? "heart.fill" : venue.waterQuality.grade.symbolName
    }

    private func markerTint(for venue: SwimVenue) -> Color {
        venue.waterQuality.grade.tintColor
    }

    private func floatingMapButton(systemImage: String, title: String) -> some View {
        Label(title, systemImage: systemImage)
            .font(.subheadline.weight(.semibold))
            .padding(.horizontal, AppSpacing.sm)
            .padding(.vertical, 10)
            .background(Color(.systemBackground).opacity(0.92))
            .clipShape(Capsule())
            .overlay(
                Capsule()
                    .stroke(Color.white.opacity(0.7), lineWidth: 1)
            )
            .shadow(color: Color.black.opacity(0.05), radius: 8, x: 0, y: 4)
    }
}

private struct SearchSubmitTextField: UIViewRepresentable {
    @Binding var text: String
    @Binding var isFirstResponder: Bool
    let placeholder: String
    let onSubmit: (String) -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    func makeUIView(context: Context) -> UITextField {
        let textField = UITextField(frame: .zero)
        textField.delegate = context.coordinator
        textField.placeholder = placeholder
        textField.returnKeyType = .search
        textField.clearButtonMode = .never
        textField.autocorrectionType = .no
        textField.autocapitalizationType = .none
        textField.spellCheckingType = .no
        textField.borderStyle = .none
        textField.font = UIFont.preferredFont(forTextStyle: .body)
        textField.addTarget(
            context.coordinator,
            action: #selector(Coordinator.textDidChange(_:)),
            for: .editingChanged
        )
        return textField
    }

    func updateUIView(_ uiView: UITextField, context: Context) {
        if uiView.text != text, uiView.markedTextRange == nil {
            uiView.text = text
        }

        if isFirstResponder, !uiView.isFirstResponder {
            uiView.becomeFirstResponder()
        } else if !isFirstResponder, uiView.isFirstResponder {
            uiView.resignFirstResponder()
        }
    }

    final class Coordinator: NSObject, UITextFieldDelegate {
        var parent: SearchSubmitTextField

        init(_ parent: SearchSubmitTextField) {
            self.parent = parent
        }

        @objc func textDidChange(_ textField: UITextField) {
            parent.text = textField.text ?? ""
        }

        func textFieldDidBeginEditing(_ textField: UITextField) {
            parent.isFirstResponder = true
        }

        func textFieldDidEndEditing(_ textField: UITextField) {
            parent.isFirstResponder = false
            parent.text = textField.text ?? ""
        }

        func textFieldShouldReturn(_ textField: UITextField) -> Bool {
            let committedText = textField.text ?? ""
            parent.text = committedText
            parent.isFirstResponder = false
            parent.onSubmit(committedText)
            textField.resignFirstResponder()
            return true
        }
    }
}
