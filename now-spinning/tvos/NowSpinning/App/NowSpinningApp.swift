import SwiftUI
import UIKit

/// Morperhaus Now Spinning: the record on the turntable, and what the archive knows about it.
///
/// The app only displays. The Pi listener identifies the song, the Worker looks it up and writes
/// every word, and this app lays the result out, exactly as the web page at /now-spinning does.
/// Nothing is interactive; the Menu button exits.
@main
struct NowSpinningApp: App {
    @State private var display: Display
    @State private var room: Room
    @Environment(\.scenePhase) private var phase

    init() {
        let display = Display()
        _display = State(initialValue: display)
        _room = State(initialValue: Room(base: Config.base, token: Config.displayToken) { state in
            display.apply(state)
        })
    }

    var body: some Scene {
        WindowGroup {
            StageView(display: display)
                // Playing keeps the Apple TV awake; idle hands over to its screensaver (OLED care).
                .onChange(of: display.keepsScreenAwake, initial: true) { _, awake in
                    UIApplication.shared.isIdleTimerDisabled = awake
                }
                // Reconnect whenever the app comes back to the front.
                .onChange(of: phase, initial: true) { _, phase in
                    switch phase {
                    case .active: room.start()
                    case .background: room.stop()
                    default: break
                    }
                }
        }
    }
}
