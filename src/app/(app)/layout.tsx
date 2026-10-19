import { AppSidebar } from "@/components/app-sidebar";
import { SimulationProvider } from "@/components/simulation-provider";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <SimulationProvider>
      <div className="flex flex-1 flex-col md:flex-row">
        <AppSidebar />
        <main className="min-w-0 flex-1 p-4 md:p-10">{children}</main>
      </div>
    </SimulationProvider>
  );
}
