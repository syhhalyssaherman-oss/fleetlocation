import "@/App.css";
import { useMemo } from "react";
import DriverCheckpoint from "@/DriverCheckpoint";
import CustomerTracking from "@/CustomerTracking";

function App() {
  const route = useMemo(() => {
    const u = new URL(window.location.href);
    if (u.searchParams.get("track")) return "track";
    if (u.searchParams.get("trip"))  return "driver";
    return "driver"; // default
  }, []);

  if (route === "track") return <CustomerTracking />;
  return <DriverCheckpoint />;
}

export default App;
