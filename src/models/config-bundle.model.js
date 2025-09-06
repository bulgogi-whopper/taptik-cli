"use strict";
/**
 * Configuration Bundle Models
 * Data models and interfaces for configuration listing functionality
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_LIST_LIMIT = exports.MAX_LIST_LIMIT = exports.DEFAULT_LIST_OPTIONS = void 0;
exports.toDisplayConfiguration = toDisplayConfiguration;
exports.formatFileSize = formatFileSize;
exports.validateListOptions = validateListOptions;
/**
 * Transform ConfigBundle to DisplayConfiguration
 * Converts raw database data to display-friendly format
 */
function toDisplayConfiguration(bundle) {
    return {
        id: bundle.id,
        title: bundle.title,
        description: bundle.description,
        createdAt: bundle.created_at,
        size: formatFileSize(bundle.file_size),
        accessLevel: bundle.is_public ? 'Public' : 'Private',
        author: bundle.author,
        isLiked: bundle.isLiked,
    };
}
/**
 * Format file size to human-readable string
 * Converts bytes to appropriate unit (B, KB, MB, GB, TB)
 */
function formatFileSize(bytes) {
    if (bytes === 0)
        return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
/**
 * Validate list options
 * Ensures CLI options are within acceptable ranges and formats
 */
function validateListOptions(options) {
    const errors = [];
    // Validate sort option
    if (options.sort && !['date', 'name'].includes(options.sort)) {
        errors.push(`Invalid sort option '${options.sort}'. Valid options: date, name`);
    }
    // Validate limit option
    if (options.limit !== undefined) {
        if (typeof options.limit !== 'number' || !Number.isInteger(options.limit)) {
            errors.push('Limit must be a positive integer');
        }
        else {
            if (options.limit <= 0) {
                errors.push('Limit must be greater than 0');
            }
            if (options.limit > 100) {
                errors.push('Limit cannot exceed 100');
            }
        }
    }
    // Validate filter (basic sanitization)
    if (options.filter !== undefined && typeof options.filter !== 'string') {
        errors.push('Filter must be a string');
    }
    return {
        isValid: errors.length === 0,
        errors,
    };
}
/**
 * Default list options
 * Provides sensible defaults for list command
 */
exports.DEFAULT_LIST_OPTIONS = {
    filter: '',
    sort: 'date',
    limit: 20,
};
/**
 * Maximum allowed limit for list results
 * Prevents excessive API usage and response sizes
 */
exports.MAX_LIST_LIMIT = 100;
/**
 * Default limit for list results
 * Balances usability with performance
 */
exports.DEFAULT_LIST_LIMIT = 20;
