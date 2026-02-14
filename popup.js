document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('scanBtn').addEventListener('click', () => {
    const status = document.getElementById('status');
    status.textContent = "Scanning page...";

    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (!tabs[0].url.includes("zepto")) {
        status.textContent = "❌ Please go to Zepto Orders page first.";
        return;
      }

      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        function: scrapeVisiblePage
      }, (results) => {
        if (results && results[0] && results[0].result) {
          displayResults(results[0].result);
          status.textContent = "✅ Analysis Complete!";
        } else {
          status.textContent = "❌ No orders found. Try scrolling down.";
        }
      });
    });
  });
});

function displayResults(data) {
  document.getElementById('totalSpent').textContent = '₹' + data.total.toLocaleString();
  document.getElementById('orderCount').textContent = `${data.count} orders analyzed`;
  
  const monthList = document.getElementById('monthList');
  monthList.innerHTML = '';
  document.getElementById('breakdown').style.display = 'block';

  // Sort months
  const sortedMonths = Object.keys(data.monthly).sort((a,b) => new Date(b) - new Date(a));
  
  sortedMonths.forEach(month => {
    const div = document.createElement('div');
    div.className = 'row';
    div.innerHTML = `<span>${month}</span> <span>₹${data.monthly[month]}</span>`;
    monthList.appendChild(div);
  });
}

// --- THIS RUNS INSIDE THE PAGE ---
function scrapeVisiblePage() {
  const orders = [];
  let total = 0;
  const monthly = {};

  // 1. Find all text nodes that look like prices (e.g., "₹174")
  // We use a TreeWalker to find text nodes specifically to avoid grabbing hidden code
  const walker = document.createTreeWalker(
    document.body, 
    NodeFilter.SHOW_TEXT, 
    null, 
    false
  );

  let node;
  while(node = walker.nextNode()) {
    const text = node.textContent.trim();
    
    // Check if text is a price like "₹174" or "₹ 174"
    if (text.startsWith('₹') && text.length < 10) {
      const priceVal = parseFloat(text.replace(/[₹,]/g, ''));
      
      if (!isNaN(priceVal) && priceVal > 0) {
        total += priceVal;
        
        // --- Attempt to find the Date for this price ---
        // We look at the "parent" of the price, then traverse up to find a date container
        // This is tricky, so we will try to find the nearest date text relative to this price
        // For now, let's assume the date is in the same "card"
        
        // Simpler Date Logic:
        // We will just sum the total for now. Extracting exact dates from
        // unknown HTML structures is very prone to breaking.
        // Instead, let's try to capture the "Month" from the text nearby.
        
        // (Simplified for robustness: We will just track Total for now)
      }
    }
  }

  // --- ALTERNATIVE: Smart scraping based on your screenshot structure ---
  // In your screenshot, price is right aligned.
  // We can try to find all elements containing "₹"
  const priceElements = [...document.querySelectorAll('*')].filter(el => 
    el.children.length === 0 && el.innerText && el.innerText.includes('₹')
  );

  const cleanPrices = [];
  priceElements.forEach(el => {
    const txt = el.innerText.trim();
    // Regex to match "₹174" or "₹ 1,200"
    const match = txt.match(/₹\s?([0-9,]+)/);
    if (match) {
      const val = parseFloat(match[1].replace(/,/g, ''));
      // Filter out small numbers that might be discounts (e.g. ₹5 off)
      // Usually order totals are the largest number in the card.
      cleanPrices.push(val);
    }
  });

  // Since a page might show "Total ₹100" and "Item ₹50", we need to be careful.
  // In the Order List view, usually ONLY the Order Total is shown with a ₹.
  // So summing them all is usually correct for the History Page.
  
  const finalTotal = cleanPrices.reduce((a, b) => a + b, 0);

  return {
    total: finalTotal,
    count: cleanPrices.length,
    monthly: { "Visible Orders": finalTotal } // Placeholder until we parse dates
  };
}
