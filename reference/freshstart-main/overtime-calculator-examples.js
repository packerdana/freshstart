import { calculateOvertimeFromClockTimes, calculateOvertime } from './src/utils/overtimeCalculator.js';

console.log('=== Overtime Calculator Examples ===\n');

console.log('Example 1: Basic overtime scenario');
console.log('Input: Start 07:30 AM, Tour 8.5 hours, End 4:07 PM');
const example1 = calculateOvertimeFromClockTimes('07:30', 8.5, '16:07');
console.log('Result:', JSON.stringify(example1, null, 2));
console.log(`Overtime: ${example1.overtime.formatted} (${example1.overtime.decimalHours} hours)`);
console.log('');

console.log('Example 2: No overtime');
console.log('Input: Start 07:30 AM, Tour 8.5 hours, End 3:45 PM');
const example2 = calculateOvertimeFromClockTimes('07:30', 8.5, '15:45');
console.log('Result:', JSON.stringify(example2, null, 2));
console.log(`Overtime: ${example2.overtime.formatted} (${example2.overtime.decimalHours} hours)`);
console.log('');

console.log('Example 3: Significant overtime');
console.log('Input: Start 07:30 AM, Tour 8.5 hours, End 5:30 PM');
const example3 = calculateOvertimeFromClockTimes('07:30', 8.5, '17:30');
console.log('Result:', JSON.stringify(example3, null, 2));
console.log(`Overtime: ${example3.overtime.formatted} (${example3.overtime.decimalHours} hours)`);
console.log('');

console.log('Example 4: Using 12-hour format input');
console.log('Input: Start 07:30 AM, Tour 8.5 hours, End 4:07 PM');
const example4 = calculateOvertimeFromClockTimes('07:30 AM', 8.5, '4:07 PM');
console.log('Result:', JSON.stringify(example4, null, 2));
console.log(`Overtime: ${example4.overtime.formatted} (${example4.overtime.decimalHours} hours)`);
console.log('');

console.log('Example 5: Using simple API');
console.log('Input: Start 07:30, Tour 8.5 hours, End 16:07');
const example5 = calculateOvertime('07:30', 8.5, '16:07');
console.log('Result:', JSON.stringify(example5, null, 2));
console.log('');

console.log('=== Usage in Route Completion ===');
console.log(`
// When user completes route:
const startTime = '07:30';  // from route.start_time
const tourLength = 8.5;      // from route.tour_length
const actualClockOut = '16:07';  // from user input

const overtimeResult = calculateOvertime(startTime, tourLength, actualClockOut);

console.log('Scheduled end time:', overtimeResult.scheduledEndTime);  // "16:00"
console.log('Overtime minutes:', overtimeResult.minutes);             // 7
console.log('Overtime decimal:', overtimeResult.decimalHours);        // 0.12
console.log('Overtime formatted:', overtimeResult.formatted);         // "0:07"
console.log('Has overtime?:', overtimeResult.isOvertime);            // true
`);
