const moment = require('moment-timezone');

/**
 * Convert a UTC timestamp to a moment in the user's local timezone.
 */
exports.getUserLocalTime = (timestamp, userTimezone = 'UTC') => {
  return moment(timestamp).tz(userTimezone);
};

/**
 * Get the UTC start/end boundaries of a user's local calendar day.
 */
exports.getUserDayBoundaries = (date, userTimezone = 'UTC') => {
  const userLocalDay = moment(date).tz(userTimezone).startOf('day');
  return {
    startTime: userLocalDay.clone().utc().toDate(),
    endTime: userLocalDay.clone().add(1, 'day').subtract(1, 'millisecond').utc().toDate()
  };
};

/**
 * Group an array of records by their local calendar day in the user's timezone.
 */
exports.groupByUserLocalDay = (data, timestampField, userTimezone = 'UTC') => {
  const grouped = {};
  data.forEach(item => {
    const day = moment(item[timestampField]).tz(userTimezone).format('YYYY-MM-DD');
    grouped[day] = grouped[day] || [];
    grouped[day].push(item);
  });
  return grouped;
};

/**
 * Get the UTC boundaries covering exactly the last N days from a reference date
 * in the user's timezone.
 */
exports.getLastNDaysBoundaries = (n, referenceDate = new Date(), userTimezone = 'UTC') => {
  const userRef = moment(referenceDate).tz(userTimezone);
  const end = userRef.clone().endOf('day');
  const start = userRef.clone().subtract(n - 1, 'days').startOf('day');
  return {
    startTime: start.clone().utc().toDate(),
    endTime: end.clone().utc().toDate(),
    startDay: start.format('YYYY-MM-DD'),
    endDay: end.format('YYYY-MM-DD')
  };
};

/**
 * Produce an array of the last N calendar dates (YYYY-MM-DD) in the user's timezone.
 */
exports.generateLastNDaysArray = (n, referenceDate = new Date(), userTimezone = 'UTC') => {
  const days = [];
  const end = moment(referenceDate).tz(userTimezone);
  for (let i = 0; i < n; i++) {
    days.unshift(end.clone().subtract(i, 'days').format('YYYY-MM-DD'));
  }
  return days;
};
