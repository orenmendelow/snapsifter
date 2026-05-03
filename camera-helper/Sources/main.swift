import Foundation
import ImageCaptureCore

// MARK: - PTP Constants

let PTP_TYPE_COMMAND: UInt16 = 0x0001
let PTP_TYPE_RESPONSE: UInt16 = 0x0003

let PTP_OP_GET_DEVICE_INFO: UInt16 = 0x1001
let PTP_OP_OPEN_SESSION: UInt16 = 0x1002
let PTP_OP_CLOSE_SESSION: UInt16 = 0x1003
let PTP_OP_GET_OBJECT_HANDLES: UInt16 = 0x1007
let PTP_OP_GET_OBJECT: UInt16 = 0x1009
let PTP_OP_DELETE_OBJECT: UInt16 = 0x100B
let PTP_OP_GET_DEVICE_PROP_VALUE: UInt16 = 0x1015
let PTP_OP_SET_DEVICE_PROP_VALUE: UInt16 = 0x1016

let FUJI_OP_SEND_OBJECT_INFO: UInt16 = 0x900C
let FUJI_OP_SEND_OBJECT2: UInt16 = 0x900D

let PTP_RSP_OK: UInt16 = 0x2001
let PTP_RSP_SESSION_ALREADY_OPEN: UInt16 = 0x201E

let FUJI_VENDOR_ID = 0x04CB

// MARK: - JSON-RPC Protocol

struct JSONRPCRequest: Decodable {
    let id: Int
    let method: String
    let params: [String: JSONValue]?
}

struct JSONRPCResponse: Encodable {
    let id: Int
    let result: [String: JSONValue]?
    let error: String?
}

enum JSONValue: Codable {
    case string(String)
    case int(Int)
    case double(Double)
    case bool(Bool)
    case array([JSONValue])
    case dict([String: JSONValue])
    case null

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let v = try? container.decode(Bool.self) { self = .bool(v) }
        else if let v = try? container.decode(Int.self) { self = .int(v) }
        else if let v = try? container.decode(Double.self) { self = .double(v) }
        else if let v = try? container.decode(String.self) { self = .string(v) }
        else if let v = try? container.decode([JSONValue].self) { self = .array(v) }
        else if let v = try? container.decode([String: JSONValue].self) { self = .dict(v) }
        else if container.decodeNil() { self = .null }
        else { throw DecodingError.dataCorruptedError(in: container, debugDescription: "Unknown type") }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let v): try container.encode(v)
        case .int(let v): try container.encode(v)
        case .double(let v): try container.encode(v)
        case .bool(let v): try container.encode(v)
        case .array(let v): try container.encode(v)
        case .dict(let v): try container.encode(v)
        case .null: try container.encodeNil()
        }
    }

    var stringValue: String? {
        if case .string(let v) = self { return v }
        return nil
    }
    var intValue: Int? {
        if case .int(let v) = self { return v }
        return nil
    }
    var arrayValue: [JSONValue]? {
        if case .array(let v) = self { return v }
        return nil
    }
}

// MARK: - PTP Container Builder

func buildPTPCommand(opcode: UInt16, transactionId: UInt32, params: [UInt32] = []) -> Data {
    var data = Data()
    var length = UInt32(12 + params.count * 4)
    var type = PTP_TYPE_COMMAND
    var code = opcode
    var txId = transactionId

    data.append(Data(bytes: &length, count: 4))
    data.append(Data(bytes: &type, count: 2))
    data.append(Data(bytes: &code, count: 2))
    data.append(Data(bytes: &txId, count: 4))

    for var p in params {
        data.append(Data(bytes: &p, count: 4))
    }
    return data
}

func extractResponseCode(from response: Data) -> UInt16 {
    guard response.count >= 8 else { return 0 }
    return UInt16(response[6]) | (UInt16(response[7]) << 8)
}

// MARK: - Camera Manager

class CameraManager: NSObject, ICDeviceBrowserDelegate, ICCameraDeviceDelegate {
    let browser = ICDeviceBrowser()
    var cameras: [ICCameraDevice] = []
    var activeCamera: ICCameraDevice?
    var transactionId: UInt32 = 0
    var sessionOpen = false

    // Pending command completion
    var pendingCompletion: ((UInt16, Data?) -> Void)?

    override init() {
        super.init()
        browser.delegate = self
        browser.browsedDeviceTypeMask = ICDeviceTypeMask.camera
    }

    func startBrowsing() {
        browser.start()
    }

    func stopBrowsing() {
        browser.stop()
    }

    func nextTransactionId() -> UInt32 {
        transactionId += 1
        return transactionId
    }

    // MARK: ICDeviceBrowserDelegate

    func deviceBrowser(_ browser: ICDeviceBrowser, didAdd device: ICDevice, moreComing: Bool) {
        log("Device discovered: \(device.name ?? "?") type=\(device.type.rawValue) VID=\(device.usbVendorID) PID=\(device.usbProductID)")
        guard let camera = device as? ICCameraDevice else {
            log("  -> Not a camera device, skipping")
            return
        }
        let vendorId = Int(device.usbVendorID)
        if vendorId == FUJI_VENDOR_ID {
            cameras.append(camera)
            log("Fujifilm camera added: \(camera.name ?? "Unknown") (VID=0x\(String(vendorId, radix: 16)), PID=0x\(String(device.usbProductID, radix: 16)))")
        } else {
            log("  -> Not Fujifilm (VID=0x\(String(vendorId, radix: 16))), skipping")
        }
    }

    func deviceBrowser(_ browser: ICDeviceBrowser, didRemove device: ICDevice, moreGoing: Bool) {
        cameras.removeAll { $0 === device }
        if activeCamera === device as? ICCameraDevice {
            activeCamera = nil
            sessionOpen = false
            log("Active camera disconnected")
        }
    }

    // MARK: ICCameraDeviceDelegate

    func cameraDevice(_ camera: ICCameraDevice, didAdd items: [ICCameraItem]) {}
    func cameraDevice(_ camera: ICCameraDevice, didRemove items: [ICCameraItem]) {}
    func cameraDevice(_ camera: ICCameraDevice, didReceivePTPEvent eventData: Data) {}
    func cameraDevice(_ camera: ICCameraDevice, didRenameItems items: [ICCameraItem]) {}
    func cameraDevice(_ camera: ICCameraDevice, didReceiveThumbnail thumbnail: CGImage?, for item: ICCameraItem, error: (any Error)?) {}
    func cameraDevice(_ camera: ICCameraDevice, didReceiveMetadata metadata: [AnyHashable : Any]?, for item: ICCameraItem, error: (any Error)?) {}
    func cameraDeviceDidChangeCapability(_ camera: ICCameraDevice) {}
    func cameraDeviceDidRemoveAccessRestriction(_ device: ICDevice) {}
    func cameraDeviceDidEnableAccessRestriction(_ device: ICDevice) {}

    func deviceDidBecomeReady(withCompleteContentCatalog device: ICCameraDevice) {
        log("Camera session ready: \(device.name ?? "Unknown")")
    }

    func device(_ device: ICDevice, didOpenSessionWithError error: (any Error)?) {
        if let error = error {
            log("Session open error: \(error.localizedDescription)")
            sessionOpen = false
        } else {
            log("Session opened")
            sessionOpen = true
        }
    }

    func device(_ device: ICDevice, didCloseSessionWithError error: (any Error)?) {
        sessionOpen = false
        if let error = error {
            log("Session closed with error: \(error.localizedDescription)")
        } else {
            log("Session closed (no error)")
        }
        Thread.callStackSymbols.prefix(5).forEach { log("  \($0)") }
    }

    func didRemove(_ device: ICDevice) {
        cameras.removeAll { $0 === device }
        if activeCamera === device as? ICCameraDevice {
            activeCamera = nil
            sessionOpen = false
        }
    }

    // MARK: PTP Commands

    func sendPTPCommand(opcode: UInt16, params: [UInt32] = [], data outData: Data? = nil,
                        completion: @escaping (UInt16, Data?) -> Void) {
        guard let camera = activeCamera else {
            completion(0, nil)
            return
        }

        pendingCompletion = completion
        let txId = nextTransactionId()
        let command = buildPTPCommand(opcode: opcode, transactionId: txId, params: params)

        camera.requestSendPTPCommand(command,
                                     outData: outData,
                                     sendCommandDelegate: self,
                                     didSendCommand: #selector(didSendPTPCommand(_:inData:response:error:contextInfo:)),
                                     contextInfo: nil)
    }

    @objc func didSendPTPCommand(_ command: Data, inData data: Data?, response: Data, error: Error?, contextInfo: UnsafeMutableRawPointer?) {
        if let error = error {
            log("PTP command error: \(error.localizedDescription)")
        }
        let code = extractResponseCode(from: response)
        log("PTP response: 0x\(String(code, radix: 16)), inData=\(data?.count ?? 0) bytes")
        let completion = pendingCompletion
        pendingCompletion = nil
        completion?(code, data)
    }

    // MARK: High-level operations

    func listCameras() -> [[String: JSONValue]] {
        return cameras.map { cam in
            [
                "name": .string(cam.name ?? "Unknown"),
                "vendorId": .int(Int(cam.usbVendorID)),
                "productId": .int(Int(cam.usbProductID)),
            ]
        }
    }

    func connect(completion: @escaping (Bool, String?) -> Void) {
        guard let camera = cameras.first else {
            completion(false, "No Fujifilm camera found")
            return
        }
        log("connect: camera=\(camera.name ?? "?"), hasOpenSession=\(camera.hasOpenSession)")
        activeCamera = camera
        camera.delegate = self

        if camera.hasOpenSession {
            log("connect: session already open, reusing")
            sessionOpen = true
            completion(true, nil)
            return
        }

        camera.requestOpenSession()

        // Wait for session to open
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) { [weak self] in
            if self?.sessionOpen == true {
                log("connect: session opened successfully")
                completion(true, nil)
            } else {
                log("connect: session FAILED to open")
                completion(false, "Session failed to open within 2s")
            }
        }
    }

    func disconnect(completion: @escaping () -> Void) {
        if let camera = activeCamera, sessionOpen {
            camera.requestCloseSession()
        }
        activeCamera = nil
        sessionOpen = false
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            completion()
        }
    }

    func getDeviceInfo(completion: @escaping ([String: JSONValue]?) -> Void) {
        sendPTPCommand(opcode: PTP_OP_GET_DEVICE_INFO) { code, data in
            guard code == PTP_RSP_OK, let data = data, data.count > 20 else {
                completion(nil)
                return
            }
            // Parse PTP DeviceInfo
            var offset = 0
            func readU16() -> UInt16 {
                guard offset + 2 <= data.count else { return 0 }
                let v = UInt16(data[offset]) | (UInt16(data[offset + 1]) << 8)
                offset += 2
                return v
            }
            func readU32() -> UInt32 {
                guard offset + 4 <= data.count else { return 0 }
                let v = UInt32(data[offset]) | (UInt32(data[offset + 1]) << 8) | (UInt32(data[offset + 2]) << 16) | (UInt32(data[offset + 3]) << 24)
                offset += 4
                return v
            }
            func readPTPString() -> String {
                guard offset < data.count else { return "" }
                let numChars = Int(data[offset])
                offset += 1
                if numChars == 0 { return "" }
                var s = ""
                for _ in 0..<numChars {
                    let ch = readU16()
                    if ch != 0 { s += String(UnicodeScalar(ch)!) }
                }
                return s
            }
            func skipU16Array() {
                let count = Int(readU32())
                offset += count * 2
            }
            func readU16Array() -> [Int] {
                let count = Int(readU32())
                var arr: [Int] = []
                for _ in 0..<count { arr.append(Int(readU16())) }
                return arr
            }

            _ = readU16() // StandardVersion
            _ = readU32() // VendorExtensionID
            _ = readU16() // VendorExtensionVersion
            _ = readPTPString() // VendorExtensionDesc
            _ = readU16() // FunctionalMode

            let operations = readU16Array()
            skipU16Array() // Events
            let properties = readU16Array()
            skipU16Array() // CaptureFormats
            skipU16Array() // ImageFormats

            let manufacturer = readPTPString()
            let model = readPTPString()
            let version = readPTPString()
            let serial = readPTPString()

            completion([
                "model": .string(model),
                "manufacturer": .string(manufacturer),
                "version": .string(version),
                "serial": .string(serial),
                "operationCount": .int(operations.count),
                "propertyCount": .int(properties.count),
            ])
        }
    }

    func readProperty(propId: UInt32, completion: @escaping (UInt16, Data?) -> Void) {
        sendPTPCommand(opcode: PTP_OP_GET_DEVICE_PROP_VALUE, params: [propId], completion: completion)
    }

    func writeProperty(propId: UInt32, data: Data, completion: @escaping (UInt16) -> Void) {
        sendPTPCommand(opcode: PTP_OP_SET_DEVICE_PROP_VALUE, params: [propId], data: data) { code, _ in
            completion(code)
        }
    }


    func clearStaleObjects(completion: @escaping () -> Void) {
        sendPTPCommand(opcode: PTP_OP_GET_OBJECT_HANDLES, params: [0xFFFFFFFF, 0, 0]) { [weak self] code, data in
            guard code == PTP_RSP_OK, let data = data, data.count >= 4 else {
                completion()
                return
            }
            let count = UInt32(data[0]) | (UInt32(data[1]) << 8) | (UInt32(data[2]) << 16) | (UInt32(data[3]) << 24)
            guard count > 0 else { completion(); return }

            var handles: [UInt32] = []
            for i in 0..<Int(count) {
                let offset = 4 + i * 4
                guard offset + 3 < data.count else { continue }
                let handle = UInt32(data[offset]) | (UInt32(data[offset+1]) << 8) | (UInt32(data[offset+2]) << 16) | (UInt32(data[offset+3]) << 24)
                handles.append(handle)
            }

            func deleteNext(_ index: Int) {
                guard index < handles.count else { completion(); return }
                log("Deleting stale object: 0x\(String(handles[index], radix: 16))")
                self?.sendPTPCommand(opcode: PTP_OP_DELETE_OBJECT, params: [handles[index]]) { _, _ in
                    deleteNext(index + 1)
                }
            }
            deleteNext(0)
        }
    }

    func uploadRAF(path: String, completion: @escaping (Bool, String?) -> Void) {
        guard let fileData = try? Data(contentsOf: URL(fileURLWithPath: path)) else {
            completion(false, "Cannot read file: \(path)")
            return
        }

        // Build ObjectInfo structure
        var objectInfo = Data()
        func appendU32(_ v: UInt32) { var val = v; objectInfo.append(Data(bytes: &val, count: 4)) }
        func appendU16(_ v: UInt16) { var val = v; objectInfo.append(Data(bytes: &val, count: 2)) }
        func appendPTPString(_ s: String) {
            if s.isEmpty { objectInfo.append(0); return }
            objectInfo.append(UInt8(s.count + 1))
            for ch in s.unicodeScalars {
                appendU16(UInt16(ch.value))
            }
            appendU16(0)
        }

        // Match FilmKit's ObjectInfo layout exactly
        appendU32(0)                        // StorageID
        appendU16(0xF802)                   // ObjectFormat (RAF)
        appendU16(0)                        // ProtectionStatus
        appendU32(UInt32(fileData.count))    // CompressedSize
        appendU16(0)                        // ThumbFormat
        appendU32(0)                        // ThumbCompressedSize
        appendU32(0)                        // ThumbPixWidth
        appendU32(0)                        // ThumbPixHeight
        appendU32(0)                        // ImagePixWidth
        appendU32(0)                        // ImagePixHeight
        appendU32(0)                        // ImageBitDepth
        appendU32(0)                        // ParentObject
        appendU16(0)                        // AssociationType
        appendU32(0)                        // AssociationDesc
        appendU32(0)                        // SequenceNumber
        appendPTPString("FUP_FILE.dat")     // Filename
        objectInfo.append(0)                // CaptureDate
        objectInfo.append(0)                // ModificationDate
        objectInfo.append(0)                // Keywords

        log("uploadRAF: session=\(sessionOpen), camera=\(activeCamera?.name ?? "nil"), fileData=\(fileData.count) bytes")

        clearStaleObjects { [weak self] in
            self?.doUpload(objectInfo: objectInfo, fileData: fileData, completion: completion)
        }
    }

    private func doUpload(objectInfo: Data, fileData: Data, completion: @escaping (Bool, String?) -> Void) {
        log("uploadRAF: sending SendObjectInfo with params [0,0,0]")
        sendPTPCommand(opcode: FUJI_OP_SEND_OBJECT_INFO, params: [0, 0, 0], data: objectInfo) { [weak self] code, _ in
            log("uploadRAF: SendObjectInfo response code=0x\(String(code, radix: 16))")
            guard code == PTP_RSP_OK else {
                completion(false, "SendObjectInfo failed: 0x\(String(code, radix: 16))")
                return
            }

            // Step 2: SendObject2 (Fuji vendor 0x900D)
            log("uploadRAF: sending SendObject2 (\(fileData.count) bytes)")
            self?.sendPTPCommand(opcode: FUJI_OP_SEND_OBJECT2, params: [], data: fileData) { code, _ in
                if code == PTP_RSP_OK {
                    completion(true, nil)
                } else {
                    completion(false, "SendObject2 failed: 0x\(String(code, radix: 16))")
                }
            }
        }
    }

    func getProfile(completion: @escaping (Data?) -> Void) {
        sendPTPCommand(opcode: PTP_OP_GET_DEVICE_PROP_VALUE, params: [0xD185]) { code, data in
            if code == PTP_RSP_OK, let data = data, !data.isEmpty {
                completion(data)
            } else {
                completion(nil)
            }
        }
    }

    func setProfile(profileData: Data, completion: @escaping (Bool) -> Void) {
        sendPTPCommand(opcode: PTP_OP_SET_DEVICE_PROP_VALUE, params: [0xD185], data: profileData) { code, _ in
            completion(code == PTP_RSP_OK)
        }
    }

    func triggerConversion(completion: @escaping (Bool) -> Void) {
        var zero: UInt16 = 0
        let data = Data(bytes: &zero, count: 2)
        sendPTPCommand(opcode: PTP_OP_SET_DEVICE_PROP_VALUE, params: [0xD183], data: data) { code, _ in
            completion(code == PTP_RSP_OK)
        }
    }

    func pollForResult(outputPath: String, timeout: TimeInterval = 30, completion: @escaping (Bool, String?) -> Void) {
        let startTime = Date()
        pollLoop(outputPath: outputPath, startTime: startTime, timeout: timeout, completion: completion)
    }

    private func pollLoop(outputPath: String, startTime: Date, timeout: TimeInterval,
                          completion: @escaping (Bool, String?) -> Void) {
        if Date().timeIntervalSince(startTime) > timeout {
            completion(false, "Conversion timeout after \(Int(timeout))s")
            return
        }

        sendPTPCommand(opcode: PTP_OP_GET_OBJECT_HANDLES, params: [0xFFFFFFFF, 0, 0]) { [weak self] code, data in
            guard code == PTP_RSP_OK, let data = data, data.count >= 8 else {
                // Retry
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                    self?.pollLoop(outputPath: outputPath, startTime: startTime, timeout: timeout, completion: completion)
                }
                return
            }

            let numHandles = UInt32(data[0]) | (UInt32(data[1]) << 8) | (UInt32(data[2]) << 16) | (UInt32(data[3]) << 24)
            if numHandles > 0 {
                let handle = UInt32(data[4]) | (UInt32(data[5]) << 8) | (UInt32(data[6]) << 16) | (UInt32(data[7]) << 24)

                // Download the result
                self?.sendPTPCommand(opcode: PTP_OP_GET_OBJECT, params: [handle]) { code, jpegData in
                    guard code == PTP_RSP_OK, let jpegData = jpegData, !jpegData.isEmpty else {
                        completion(false, "GetObject failed")
                        return
                    }

                    do {
                        let outputURL = URL(fileURLWithPath: outputPath)
                        try FileManager.default.createDirectory(at: outputURL.deletingLastPathComponent(), withIntermediateDirectories: true)
                        try jpegData.write(to: outputURL)
                        // Cleanup temp object
                        self?.sendPTPCommand(opcode: PTP_OP_DELETE_OBJECT, params: [handle]) { _, _ in
                            completion(true, nil)
                        }
                    } catch {
                        completion(false, "Failed to write output: \(error.localizedDescription)")
                    }
                }
            } else {
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                    self?.pollLoop(outputPath: outputPath, startTime: startTime, timeout: timeout, completion: completion)
                }
            }
        }
    }
}

// MARK: - Logging (stderr so stdout stays clean for JSON-RPC)

func log(_ message: String) {
    FileHandle.standardError.write("[\(ISO8601DateFormatter().string(from: Date()))] \(message)\n".data(using: .utf8)!)
}

// MARK: - Request Handler

let manager = CameraManager()

func handleRequest(_ request: JSONRPCRequest) {
    let id = request.id

    func respond(result: [String: JSONValue]) {
        let resp = JSONRPCResponse(id: id, result: result, error: nil)
        sendResponse(resp)
    }
    func respondError(_ msg: String) {
        let resp = JSONRPCResponse(id: id, result: nil, error: msg)
        sendResponse(resp)
    }

    switch request.method {
    case "list":
        // Wait up to 3s for browser to discover cameras if none found yet
        if manager.cameras.isEmpty {
            var waited = 0
            func checkCameras() {
                if !manager.cameras.isEmpty || waited >= 6 {
                    let cams = manager.listCameras()
                    respond(result: ["cameras": .array(cams.map { .dict($0) })])
                } else {
                    waited += 1
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { checkCameras() }
                }
            }
            checkCameras()
        } else {
            let cams = manager.listCameras()
            respond(result: ["cameras": .array(cams.map { .dict($0) })])
        }

    case "connect":
        manager.connect { ok, err in
            if ok {
                respond(result: ["ok": .bool(true)])
            } else {
                respondError(err ?? "Connection failed")
            }
        }

    case "disconnect":
        manager.disconnect {
            respond(result: ["ok": .bool(true)])
        }

    case "deviceInfo":
        manager.getDeviceInfo { info in
            if let info = info {
                respond(result: info)
            } else {
                respondError("Failed to get device info")
            }
        }

    case "readProp":
        guard let propId = request.params?["propId"]?.intValue else {
            respondError("Missing propId"); return
        }
        manager.readProperty(propId: UInt32(propId)) { code, data in
            var result: [String: JSONValue] = ["code": .int(Int(code))]
            if let data = data {
                result["data"] = .string(data.base64EncodedString())
                result["size"] = .int(data.count)
            }
            respond(result: result)
        }

    case "writeProp":
        guard let propId = request.params?["propId"]?.intValue,
              let dataStr = request.params?["data"]?.stringValue,
              let data = Data(base64Encoded: dataStr) else {
            respondError("Missing propId or data (base64)"); return
        }
        manager.writeProperty(propId: UInt32(propId), data: data) { code in
            respond(result: ["code": .int(Int(code))])
        }

    case "uploadRaf":
        guard let path = request.params?["path"]?.stringValue else {
            respondError("Missing path"); return
        }
        manager.uploadRAF(path: path) { ok, err in
            if ok {
                respond(result: ["ok": .bool(true)])
            } else {
                respondError(err ?? "Upload failed")
            }
        }

    case "getProfile":
        manager.getProfile { data in
            if let data = data {
                respond(result: [
                    "data": .string(data.base64EncodedString()),
                    "size": .int(data.count),
                ])
            } else {
                respondError("Failed to read profile (is a RAF loaded?)")
            }
        }

    case "setProfile":
        guard let dataStr = request.params?["data"]?.stringValue,
              let data = Data(base64Encoded: dataStr) else {
            respondError("Missing data (base64)"); return
        }
        manager.setProfile(profileData: data) { ok in
            respond(result: ["ok": .bool(ok)])
        }

    case "triggerConversion":
        manager.triggerConversion { ok in
            respond(result: ["ok": .bool(ok)])
        }

    case "waitForResult":
        guard let outputPath = request.params?["outputPath"]?.stringValue else {
            respondError("Missing outputPath"); return
        }
        let timeout = request.params?["timeout"]?.intValue.map { TimeInterval($0) } ?? 30
        manager.pollForResult(outputPath: outputPath, timeout: timeout) { ok, err in
            if ok {
                respond(result: ["ok": .bool(true)])
            } else {
                respondError(err ?? "Conversion failed")
            }
        }

    case "sendCommand":
        guard let opcode = request.params?["opcode"]?.intValue else {
            respondError("Missing opcode"); return
        }
        let params = request.params?["params"]?.arrayValue?.compactMap { $0.intValue }.map { UInt32($0) } ?? []
        let outData: Data?
        if let dataStr = request.params?["data"]?.stringValue {
            outData = Data(base64Encoded: dataStr)
        } else {
            outData = nil
        }
        manager.sendPTPCommand(opcode: UInt16(opcode), params: params, data: outData) { code, data in
            var result: [String: JSONValue] = ["code": .int(Int(code))]
            if let data = data {
                result["data"] = .string(data.base64EncodedString())
                result["size"] = .int(data.count)
            }
            respond(result: result)
        }

    default:
        respondError("Unknown method: \(request.method)")
    }
}

func sendResponse(_ response: JSONRPCResponse) {
    let encoder = JSONEncoder()
    encoder.outputFormatting = []
    guard let data = try? encoder.encode(response) else { return }
    let line = String(data: data, encoding: .utf8)! + "\n"
    FileHandle.standardOutput.write(line.data(using: .utf8)!)
}

// MARK: - Main

log("camera-helper starting")
manager.startBrowsing()

// Give ICDeviceBrowser time to discover cameras on launch
DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
    log("Browser ready, \(manager.cameras.count) camera(s) found")
}

// Read JSON-RPC requests from stdin (one per line)
let stdinSource = DispatchSource.makeReadSource(fileDescriptor: FileHandle.standardInput.fileDescriptor, queue: .main)
var stdinBuffer = Data()

stdinSource.setEventHandler {
    let available = FileHandle.standardInput.availableData
    if available.isEmpty {
        log("stdin closed, exiting")
        exit(0)
    }
    stdinBuffer.append(available)

    while let newlineRange = stdinBuffer.range(of: Data("\n".utf8)) {
        let lineData = stdinBuffer.subdata(in: stdinBuffer.startIndex..<newlineRange.lowerBound)
        stdinBuffer.removeSubrange(stdinBuffer.startIndex...newlineRange.lowerBound)

        guard !lineData.isEmpty else { continue }

        do {
            let request = try JSONDecoder().decode(JSONRPCRequest.self, from: lineData)
            handleRequest(request)
        } catch {
            log("Parse error: \(error)")
            let resp = JSONRPCResponse(id: -1, result: nil, error: "Parse error: \(error.localizedDescription)")
            sendResponse(resp)
        }
    }
}
stdinSource.resume()

// Run the main RunLoop (required for ImageCaptureCore delegate callbacks)
RunLoop.main.run()
