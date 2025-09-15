# VHS Configuration
Output ./tape/3-deploy.mp4
Set Theme "Dracula"
Set FontSize 20
Set Width 1400
Set Height 800
Set PlaybackSpeed 1.0

# === Section 3: Deploy (13초) ===
# 음성: "Finally, deploying to a different platform: 'pnpm cli deploy --platform kiro --conflict-strategy merge'"
Type "pnpm cli deploy --platform kiro --conflict-strategy merge"
Enter
Sleep 4s

# 음성: "this applies the configuration with intelligent conflict resolution"
