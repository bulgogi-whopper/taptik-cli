# VHS Configuration
Output ./tape/1-login.mp4
Set Theme "Dracula"
Set FontSize 20
Set Width 1400
Set Height 800
Set PlaybackSpeed 1.0

# === Section 1: OAuth Authentication (15초) ===
# 음성: "First, authentication with OAuth: 'pnpm cli login --provider google'"
Type "pnpm cli login --provider google"
Enter
Sleep 5s
Down
Enter
Sleep 5s
