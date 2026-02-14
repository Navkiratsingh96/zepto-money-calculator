document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('scanBtn').addEventListener('click', () => {
    const status = document.getElementById('status');
    status.textContent = "Scanning...";

    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        function: scrapeByLayout
      }, (results) => {
        if (results && results[0] && results[0].result) {
          const data = results[0].result;
          document.getElementById('totalSpent').textContent = '₹' + data.total.toLocaleString();
          document.getElementById('orderCount').textContent = `${data.count} orders found`;
          status.textContent = "✅ Success!";
        } else {
          status.textContent = "❌ No prices found. Scroll down more?";
        }
      });
    });
  });
});

// THIS FUNCTION RUNS INSIDE THE PAGE
function scrapeByLayout() {
  let total = 0;
  let count = 0;

  // STRATEGY: Find the "Order delivered" text, then find the price in that same card.
  // 1. Find all elements that say "Order delivered" (The green text in your screenshot)
  // We look for specific text content to be safe.
  const allTags = Array.from(document.getElementsByTagName("*"));
  const deliveryTags = allTags.filter(el => 
    el.innerText && el.innerText.includes("Order delivered") && el.children.length === 0
  );

  deliveryTags.forEach(tag => {
    // 2. Go up to the parent container (The 'Card')
    // We traverse up 3-4 levels to find the container that holds both the "Delivered" text AND the price
    let parent = tag.parentElement;
    let foundPrice = false;
    
    // Check up to 5 layers of parents
    for(let i=0; i<5; i++) {
      if(!parent) break;

      // 3. In this parent, look for a price number
      // We look for any text that matches the price pattern (Number followed by '>')
      // OR just a number that is NOT a date/time.
      const text = parent.innerText;
      
      // Regex Explanation:
      // Look for a number (1-6 digits)
      // That might have a comma
      // That is at the end of a line OR followed by a '>' symbol
      const matches = text.match(/([0-9,]+)\s?>/);

      if (matches && matches[1]) {
        const priceStr = matches[1].replace(/,/g, '');
        const price = parseFloat(priceStr);

        // Filter: Price must be reasonable (e.g. > 10 rupees) to avoid capturing dates like "2026"
        if (price > 10 && price < 100000) {
            total += price;
            count++;
            foundPrice = true;
            break; // Stop looking for this specific order, we found it.
        }
      }
      parent = parent.parentElement;
    }
  });

  return { total, count };
}
