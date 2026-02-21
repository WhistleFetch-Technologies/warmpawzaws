/**
 * Check available slots for a vendor for all service styles
 * Vendor: Friendly tails pet hospital (863d5f9f-2cec-4792-9ea8-64c98059061c)
 */

const API_BASE_URL = "https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com";
const VENDOR_ID = "863d5f9f-2cec-4792-9ea8-64c98059061c";

// Get today's date and next 7 days
function getDates() {
  const dates = [];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    dates.push(date.toISOString().split('T')[0]); // YYYY-MM-DD
  }
  return dates;
}

async function checkSlots(serviceStyle, date) {
  try {
    const url = `${API_BASE_URL}/customer/vendor/${VENDOR_ID}/available-slots?date=${date}&serviceStyle=${serviceStyle}`;
    console.log(`\n  Checking ${serviceStyle} for ${date}...`);
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.success && data.slots && data.slots.length > 0) {
      return {
        available: true,
        count: data.slots.length,
        slots: data.slots.slice(0, 5), // First 5 slots
        message: data.message || null
      };
    } else {
      return {
        available: false,
        count: 0,
        message: data.message || data.error || 'No slots available',
        reason: data.reason || null
      };
    }
  } catch (error) {
    return {
      available: false,
      error: error.message
    };
  }
}

async function checkAllServiceStyles() {
  console.log('='.repeat(80));
  console.log('CHECKING AVAILABLE SLOTS FOR VENDOR');
  console.log('='.repeat(80));
  console.log(`Vendor ID: ${VENDOR_ID}`);
  console.log(`Business: Friendly tails pet hospital`);
  console.log(`API Base: ${API_BASE_URL}`);
  console.log('');
  
  const dates = getDates();
  const serviceStyles = ['at_center', 'at_home', 'tele'];
  
  const results = {};
  
  for (const style of serviceStyles) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`SERVICE STYLE: ${style.toUpperCase()}`);
    console.log('='.repeat(80));
    
    results[style] = {};
    
    for (const date of dates) {
      const result = await checkSlots(style, date);
      results[style][date] = result;
      
      if (result.available) {
        console.log(`  ✅ ${date}: ${result.count} slot(s) available`);
        if (result.slots && result.slots.length > 0) {
          console.log(`     First slots: ${result.slots.map(s => s.time || s.startTime || s.slot).join(', ')}`);
        }
      } else {
        console.log(`  ❌ ${date}: ${result.message || result.error || 'No slots'}`);
        if (result.reason) {
          console.log(`     Reason: ${result.reason}`);
        }
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  
  for (const style of serviceStyles) {
    console.log(`\n${style.toUpperCase()}:`);
    let totalSlots = 0;
    let daysWithSlots = 0;
    
    for (const date of dates) {
      const result = results[style][date];
      if (result.available) {
        totalSlots += result.count;
        daysWithSlots++;
      }
    }
    
    if (daysWithSlots > 0) {
      console.log(`  ✅ Available on ${daysWithSlots} day(s), ${totalSlots} total slots`);
    } else {
      console.log(`  ❌ No slots available on any day`);
      // Check first day's message for reason
      const firstDayResult = results[style][dates[0]];
      if (firstDayResult.message) {
        console.log(`     Reason: ${firstDayResult.message}`);
      }
    }
  }
  
  console.log('\n' + '='.repeat(80));
}

// Run the check
checkAllServiceStyles().catch(console.error);
