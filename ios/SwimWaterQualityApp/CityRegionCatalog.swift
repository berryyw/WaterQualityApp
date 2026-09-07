import MapKit

enum CityRegionCatalog {
    static let regions: [SupportedCity: MKCoordinateRegion] = [
        .losAngeles: MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: 34.0522, longitude: -118.2437),
            span: MKCoordinateSpan(latitudeDelta: 0.22, longitudeDelta: 0.22)
        ),
        .beijing: MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: 40.0500, longitude: 116.4200),
            span: MKCoordinateSpan(latitudeDelta: 1.85, longitudeDelta: 2.20)
        ),
        .shanghai: MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: 31.2304, longitude: 121.4737),
            span: MKCoordinateSpan(latitudeDelta: 0.72, longitudeDelta: 0.72)
        ),
        .shenzhen: MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: 22.5900, longitude: 114.0600),
            span: MKCoordinateSpan(latitudeDelta: 0.68, longitudeDelta: 0.68)
        ),
        .guangzhou: MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: 23.1291, longitude: 113.2644),
            span: MKCoordinateSpan(latitudeDelta: 0.78, longitudeDelta: 0.78)
        )
    ]
}
