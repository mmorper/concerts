import Foundation
import os

/// The connection to the Worker: a WebSocket, with polling while it is down.
///
///   GET /api/now-spinning/ws   WebSocket: the current state on connect, then each change
///   GET /api/now-spinning      the current state, polled every 10 s while the socket is down
///
/// Both send the display token as `Authorization: Bearer`. A 401 stops everything: without a
/// valid token the app shows the idle screen only.
@MainActor
final class Room {
    enum Status: String { case stopped, connecting, live, reconnecting, refused, noToken }

    static let pollInterval: Duration = .seconds(10)

    private(set) var status: Status = .stopped
    private let base: URL
    private let token: String?
    private let session: URLSession
    private let onState: @MainActor (NowSpinningState) -> Void
    private let log = Logger(subsystem: "org.morperhaus.nowspinning", category: "room")

    private var socket: URLSessionWebSocketTask?
    private var receiveTask: Task<Void, Never>?
    private var reconnectTask: Task<Void, Never>?
    private var pollTask: Task<Void, Never>?
    private var attempt = 0

    init(base: URL, token: String?, onState: @escaping @MainActor (NowSpinningState) -> Void) {
        self.base = base
        self.token = token
        self.onState = onState
        let config = URLSessionConfiguration.default
        config.requestCachePolicy = .reloadIgnoringLocalCacheData
        config.urlCache = nil
        self.session = URLSession(configuration: config)
    }

    /// Connect, or reconnect at once: on launch, and whenever the app returns to the front.
    func start() {
        guard token != nil else {
            status = .noToken
            log.notice("No display token in Secrets.xcconfig: idle screen only")
            return
        }
        guard status != .refused else { return }
        guard socket == nil else { return }
        attempt = 0
        connect()
    }

    /// The app left the front. Nothing runs in the background.
    func stop() {
        guard status != .refused, status != .noToken else { return }
        tearDown()
        status = .stopped
    }

    // MARK: - WebSocket

    private func connect() {
        guard let token else { return }
        reconnectTask?.cancel()
        var request = URLRequest(url: base.appending(path: "api/now-spinning/ws"))
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        let task = session.webSocketTask(with: request)
        socket = task
        status = attempt == 0 ? .connecting : .reconnecting
        task.resume()
        receiveTask = Task { [weak self] in await self?.receive(on: task) }
    }

    private func receive(on task: URLSessionWebSocketTask) async {
        do {
            while !Task.isCancelled {
                let message = try await task.receive()
                guard socket === task else { return }
                if status != .live {
                    status = .live
                    attempt = 0
                    stopPolling()
                    log.info("live")
                }
                switch message {
                case .string(let text): deliver(Data(text.utf8))
                case .data(let data): deliver(data)
                @unknown default: break
                }
            }
        } catch {
            guard socket === task else { return }
            log.info("socket closed: \(error.localizedDescription, privacy: .public)")
            socket = nil
            startPolling()
            scheduleReconnect()
        }
    }

    private func scheduleReconnect() {
        guard status != .refused else { return }
        attempt += 1
        status = .reconnecting
        // 1 s, doubling, at most 30 s, with a little jitter so displays don't reconnect in step.
        let seconds = min(30, pow(2, Double(min(attempt - 1, 5)))) + Double.random(in: 0...0.5)
        reconnectTask?.cancel()
        reconnectTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(seconds))
            guard !Task.isCancelled else { return }
            self?.connect()
        }
    }

    // MARK: - Polling

    private func startPolling() {
        guard pollTask == nil else { return }
        pollTask = Task { [weak self] in
            while !Task.isCancelled {
                await self?.poll()
                try? await Task.sleep(for: Room.pollInterval)
            }
        }
    }

    private func stopPolling() {
        pollTask?.cancel()
        pollTask = nil
    }

    private func poll() async {
        guard let token else { return }
        var request = URLRequest(url: base.appending(path: "api/now-spinning"))
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        guard let (data, response) = try? await session.data(for: request),
              let http = response as? HTTPURLResponse else { return }
        if http.statusCode == 401 {
            refuse()
            return
        }
        guard http.statusCode == 200, status != .live else { return }
        deliver(data)
    }

    private func refuse() {
        log.error("The Worker refused the display token (401): idle screen only")
        tearDown()
        status = .refused
        onState(.idle)
    }

    private func tearDown() {
        receiveTask?.cancel()
        reconnectTask?.cancel()
        stopPolling()
        socket?.cancel(with: .goingAway, reason: nil)
        socket = nil
        receiveTask = nil
        reconnectTask = nil
    }

    private func deliver(_ data: Data) {
        guard let state = try? JSONDecoder().decode(NowSpinningState.self, from: data) else {
            log.error("A message that isn't a state; ignored")
            return
        }
        // The state's kind only: no song data in the log (spec §Privacy).
        log.info("state: \(state.kindName, privacy: .public)")
        onState(state)
    }
}

enum Config {
    static let base = URL(string: "https://concerts.morperhaus.org")!

    /// From Secrets.xcconfig, through Info.plist. Hex only, as `openssl rand -hex 32` makes it.
    static var displayToken: String? {
        guard let t = Bundle.main.object(forInfoDictionaryKey: "NowSpinningDisplayToken") as? String,
              t.range(of: "^[0-9a-fA-F]{16,256}$", options: .regularExpression) != nil else { return nil }
        return t
    }
}
