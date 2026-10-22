'use strict';

const CHANNELS = {
  HEALTH: 'helios:health',
  SYSTEM_SNAPSHOT: 'helios:system:snapshot',
  SYSTEM_PROCESSES: 'helios:system:processes',
  BACKEND_STATUS: 'helios:backend:status',
};

const HELIOS_CHANNELS = Object.values(CHANNELS);

module.exports = { CHANNELS, HELIOS_CHANNELS };
