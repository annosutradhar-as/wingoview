// worker.js

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url);

  // ১. যদি রিয়ালটাইম API রিকোয়েস্ট আসে (যেমন: ?live=1)
  if (url.searchParams.get('live') === '1') {
    const targetApiUrl = `https://draw.ar-lottery01.com/WinGo/WinGo_30S/GetHistoryIssuePage.json?pageSize=15&pageNo=1&ts=${Date.now()}`;
    
    try {
      const apiResponse = await fetch(targetApiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Accept': 'application/json'
        }
      });

      const data = await apiResponse.json();

      // CORS Header সহ JSON রিটার্ন
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: {
          'Content-Type': 'application/json;charset=UTF-8',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-store, no-cache, must-revalidate'
        }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: "API Fetch Failed", message: err.message }), {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*' 
        }
      });
    }
  }

  // ২. সাধারণ পেজ ভিজিটের সময় index.html বা Static Assets রেন্ডার হবে
  // (আপনি যদি KV Asset/HTML Serve করেন তবে নিচে সেই লজিক থাকবে)
  return fetch(request); 
}