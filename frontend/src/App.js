import "@/App.css";
import { useMemo } from "react";
import DriverCheckpoint from "@/DriverCheckpoint";
import CustomerTracking from "@/CustomerTracking";
import BASTKPage from "@/BASTKPage";
import CustomerOrderForm from "@/CustomerOrderForm";
import AdminDashboard from "@/AdminDashboard";
import OperationGuide from "@/OperationGuide";

function App() {
  const route = useMemo(() => {
    const u = new URL(window.location.href);
    if (u.searchParams.get("guide")) return "guide";
    if (u.searchParams.get("admin")) return "admin";
    if (u.searchParams.get("order")) return "order";
    if (u.searchParams.get("bastk")) return "bastk";
    if (u.searchParams.get("track")) return "track";
    if (u.searchParams.get("trip"))  return "driver";
    return "driver"; // default
  }, []);

  if (route === "guide") return <OperationGuide />;
  if (route === "admin") return <AdminDashboard />;
  if (route === "order") return <CustomerOrderForm />;
  if (route === "bastk") return <BASTKPage />;
  if (route === "track") return <CustomerTracking />;
  return <DriverCheckpoint />;
}

export default App;
