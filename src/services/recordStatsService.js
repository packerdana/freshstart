import { format, parseISO } from 'date-fns';

export function calculateRecordDays(history) {
  if (!history || history.length === 0) {
    return null;
  }

  const records = {
    dps: { value: 0, date: null },
    letters: { value: 0, date: null },
    flats: { value: 0, date: null },
    parcels: { value: 0, date: null },
    spurs: { value: 0, date: null }
  };

  history.forEach(day => {
    if (day.dps > records.dps.value) {
      records.dps.value = day.dps;
      records.dps.date = day.date;
    }

    if (day.letters > records.letters.value) {
      records.letters.value = day.letters;
      records.letters.date = day.date;
    }

    if (day.flats > records.flats.value) {
      records.flats.value = day.flats;
      records.flats.date = day.date;
    }

    if (day.parcels > records.parcels.value) {
      records.parcels.value = day.parcels;
      records.parcels.date = day.date;
    }

    if (day.spurs > records.spurs.value) {
      records.spurs.value = day.spurs;
      records.spurs.date = day.date;
    }
  });

  const hasAnyRecords = Object.values(records).some(record => record.value > 0);

  return hasAnyRecords ? records : null;
}

export function formatRecordValue(value, category) {
  if (value === 0) return 'No data';

  const formattedNumber = value.toLocaleString();

  if (category === 'dps' || category === 'letters' || category === 'flats' || category === 'parcels') {
    return `${formattedNumber} pieces`;
  } else if (category === 'spurs') {
    return `${formattedNumber} routes`;
  }

  return formattedNumber;
}

export function formatRecordDate(dateString) {
  if (!dateString) return 'N/A';

  try {
    const date = parseISO(dateString);
    return format(date, 'MMMM d, yyyy');
  } catch (error) {
    return dateString;
  }
}
