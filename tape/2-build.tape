# VHS Configuration
Output ./tape/2-build.mp4
Set Theme "Dracula"
Set FontSize 20
Set Width 1400
Set Height 800
Set PlaybackSpeed 1.0

# === Section 2: Build with Dry Run (18초) ===
# 음성: "Next, building a configuration package."
Type "pnpm cli build --platform kiro --categories personal,project"
Enter
Sleep 10s

# 음성: "this scans my current Kiro setup"
