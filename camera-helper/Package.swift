// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "camera-helper",
    platforms: [.macOS(.v13)],
    targets: [
        .executableTarget(
            name: "camera-helper",
            path: "Sources",
            linkerSettings: [
                .linkedFramework("ImageCaptureCore"),
                .unsafeFlags(["-Xlinker", "-sectcreate", "-Xlinker", "__TEXT", "-Xlinker", "__info_plist", "-Xlinker", "Sources/Info.plist"]),
            ]
        ),
    ]
)
