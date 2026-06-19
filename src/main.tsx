
  import { createRoot } from "react-dom/client";
  import App from "./app/App";
  import "./styles/index.css";

  console.log('main.tsx: booting app');
// mark that the boot script executed (useful when inspecting DOM from outside)
document.documentElement.setAttribute('data-app-boot', 'true');

try {
  createRoot(document.getElementById("root")!).render(<App />);
} catch (err) {
  console.error('Render error:', err);
  // Make errors visible to the user in the page body
  document.body.innerHTML = `<pre style="white-space:pre-wrap;background:#fee;border:2px solid #f88;padding:16px;color:#900">Render error: ${String(err)}</pre>`;
  throw err;
}
  