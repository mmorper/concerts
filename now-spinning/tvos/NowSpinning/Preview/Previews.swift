import SwiftUI

// One preview per state in test/fixtures/now-spinning-states.json. Compare each with its
// screenshot in docs/specs/future/global-now-spinning/screens/ (the spec's Screen states section
// maps them). A name missing from the file shows the idle screen.

#Preview("heard") { StageView(display: Fixtures.display("heard")) }
#Preview("heard, mirrored") { StageView(display: Fixtures.display("heard", flipped: true)) }
#Preview("heard-medley") { StageView(display: Fixtures.display("heard-medley")) }
#Preview("seen-cover") { StageView(display: Fixtures.display("seen-cover")) }
#Preview("seen") { StageView(display: Fixtures.display("seen")) }
#Preview("seen-near") { StageView(display: Fixtures.display("seen-near")) }
#Preview("seen-maybe") { StageView(display: Fixtures.display("seen-maybe")) }
#Preview("cover-of-this") { StageView(display: Fixtures.display("cover-of-this")) }
#Preview("covers") { StageView(display: Fixtures.display("covers")) }
#Preview("none") { StageView(display: Fixtures.display("none")) }
#Preview("unknown") { StageView(display: Fixtures.display("unknown")) }
#Preview("idle") { StageView(display: Fixtures.display("idle")) }
#Preview("idle-offline") { StageView(display: Fixtures.display("idle-offline")) }
#Preview("idle-recognition") { StageView(display: Fixtures.display("idle-recognition")) }
#Preview("gap (faded)") { StageView(display: Fixtures.display("gap")) }
#Preview("unmatched") { StageView(display: Fixtures.display("unmatched")) }
