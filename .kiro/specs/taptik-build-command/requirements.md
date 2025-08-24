# Requirements Document

## Introduction

The `taptik build` command is a core feature of the taptik CLI tool that enables users to collect and package their AI IDE settings from Kiro into a standardized format for migration and synchronization. This command provides an interactive interface for users to select which platform and categories of settings they want to build, then processes and converts these settings into the taptik standard specification format.

## Requirements

### Requirement 1

**User Story:** As a developer using Kiro, I want to interactively select my source platform, so that I can build settings from the correct AI IDE.

#### Acceptance Criteria

1. WHEN the user runs `npx taptik build` THEN the system SHALL display an interactive platform selection menu
2. WHEN the platform selection menu is displayed THEN the system SHALL show "Kiro", "Cursor", and "Claude Code" options
3. WHEN the user selects "Kiro" THEN the system SHALL proceed to category selection
4. WHEN the user selects "Cursor" or "Claude Code" THEN the system SHALL display "Comming soon" message and exit gracefully
5. IF no platform is selected within 30 seconds THEN the system SHALL timeout and exit with appropriate message

### Requirement 2

**User Story:** As a developer, I want to select multiple categories of settings to build, so that I can control which types of configurations are included in my build.

#### Acceptance Criteria

1. WHEN platform selection is completed THEN the system SHALL display a multi-select category menu
2. WHEN the category menu is displayed THEN the system SHALL show "Personal Context", "Project Context", and "Prompt Templates" options
3. WHEN the user selects categories using spacebar THEN the system SHALL toggle selection state visually
4. WHEN the user presses 'a' THEN the system SHALL toggle all categories
5. WHEN the user confirms selection THEN the system SHALL proceed with building only selected categories
6. IF no categories are selected THEN the system SHALL display error message and return to category selection

### Requirement 3

**User Story:** As a Kiro user, I want the system to collect my local project settings, so that my project-specific configurations are included in the build.

#### Acceptance Criteria

1. WHEN "Project Context" is selected THEN the system SHALL scan the current project's `.kiro/` directory
2. WHEN scanning local settings THEN the system SHALL collect `settings/context.md`, `settings/user-preferences.md`, `settings/project-spec.md`
3. WHEN scanning local settings THEN the system SHALL collect all files from `steerng/*.md` directory
4. WHEN scanning local settings THEN the system SHALL collect all files from `hooks/*.kiro.hook` directory
5. IF `.kiro/` directory does not exist THEN the system SHALL log warning and continue with empty local settings
6. IF individual setting files are missing THEN the system SHALL log info message and skip those files

### Requirement 4

**User Story:** As a Kiro user, I want the system to collect my global Kiro settings, so that my user-wide preferences are included in the build.

#### Acceptance Criteria

1. WHEN "Personal Context" is selected THEN the system SHALL scan the user's home directory for Kiro global settings
2. WHEN scanning global settings THEN the system SHALL collect files from `~/.kiro/` directory
3. WHEN scanning global settings THEN the system SHALL collect user configuration files, global prompt templates, and user preferences
4. WHEN scanning global settings THEN the system SHALL exclude security-sensitive information like API keys and tokens
5. IF global Kiro directory does not exist THEN the system SHALL log warning and continue with empty global settings
6. IF access to home directory is denied THEN the system SHALL display error message and continue without global settings

### Requirement 5

**User Story:** As a developer, I want my collected settings to be converted to taptik standard format, so that they can be used for migration and synchronization.

#### Acceptance Criteria

1. WHEN settings collection is complete THEN the system SHALL convert collected data to taptik standard specification format
2. WHEN converting Personal Context THEN the system SHALL map Kiro user preferences to personal-context.json format
3. WHEN converting Project Context THEN the system SHALL map Kiro project settings to project-context.json format
4. WHEN converting Prompt Templates THEN the system SHALL map Kiro prompts to prompt-templates.json format
5. WHEN conversion fails for any category THEN the system SHALL log error and exclude that category from build
6. WHEN conversion is successful THEN the system SHALL validate output against taptik specification schema

### Requirement 6

**User Story:** As a user, I want to see real-time progress during the build process, so that I understand what the system is doing and can track completion.

#### Acceptance Criteria

1. WHEN build process starts THEN the system SHALL display progress indicators with descriptive messages
2. WHEN scanning local settings THEN the system SHALL show "✓ Scanning local Kiro settings..." with spinner
3. WHEN scanning global settings THEN the system SHALL show "✓ Scanning global Kiro settings..." with spinner
4. WHEN converting categories THEN the system SHALL show "✓ [Category] Complete Conversion!" for each completed category
5. WHEN build completes THEN the system SHALL display summary with output directory and file sizes
6. IF any step fails THEN the system SHALL display error message with clear indication of what failed

### Requirement 7

**User Story:** As a developer, I want my build output organized in a timestamped directory, so that I can manage multiple builds and avoid conflicts.

#### Acceptance Criteria

1. WHEN build process completes THEN the system SHALL create output directory with format `./taptik-build-YYYYMMDD-HHMMSS/`
2. WHEN creating output directory THEN the system SHALL generate `manifest.json` with build metadata
3. WHEN creating output files THEN the system SHALL create separate JSON files for each selected category
4. WHEN creating manifest THEN the system SHALL include build_id, source_platform, categories, created_at, taptik_version, and source_files
5. IF output directory already exists THEN the system SHALL append incremental number to avoid conflicts
6. WHEN build completes THEN the system SHALL display output directory path and file summary

### Requirement 8

**User Story:** As a developer, I want the command to handle errors gracefully, so that I can understand what went wrong and how to fix it.

#### Acceptance Criteria

1. WHEN file system access fails THEN the system SHALL display clear error message with suggested resolution
2. WHEN JSON parsing fails THEN the system SHALL log specific file and error details
3. WHEN conversion fails THEN the system SHALL continue with other categories and report partial success
4. WHEN critical errors occur THEN the system SHALL exit with appropriate error code (non-zero)
5. WHEN warnings occur THEN the system SHALL continue execution and display warning summary at end
6. IF user interrupts process (Ctrl+C) THEN the system SHALL cleanup partial files and exit gracefully
