'use strict';

/**
 * Entitlement Constants
 * Centralized mappings for content types across the platform.
 */

const CONTENT_TYPES = {
    EVENT: 'event',
    COURSE: 'course',
    CHALLENGE: 'challenge'
};

// Maps entitlement content_types to user-entitlement schema identifiers
const USER_ENTITLEMENT_MAP = {
    [CONTENT_TYPES.EVENT]: 'event',
    [CONTENT_TYPES.COURSE]: 'course',
    [CONTENT_TYPES.CHALLENGE]: 'challenge'
};

module.exports = {
    CONTENT_TYPES,
    USER_ENTITLEMENT_MAP
};
