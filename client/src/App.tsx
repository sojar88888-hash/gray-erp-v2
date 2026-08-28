import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import DashboardLayout from "./components/DashboardLayout";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import ModulePage from "./pages/ModulePage";
import NotFound from "./pages/NotFound";

function RoutedApplication() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/sales">{() => <ModulePage moduleKey="sales" />}</Route>
        <Route path="/purchases">{() => <ModulePage moduleKey="purchases" />}</Route>
        <Route path="/inventory">{() => <ModulePage moduleKey="inventory" />}</Route>
        <Route path="/cash">{() => <ModulePage moduleKey="cash" />}</Route>
        <Route path="/operations">{() => <ModulePage moduleKey="operations" />}</Route>
        <Route path="/accounting">{() => <ModulePage moduleKey="accounting" />}</Route>
        <Route path="/reports">{() => <ModulePage moduleKey="reports" />}</Route>
        <Route path="/projects">{() => <ModulePage moduleKey="projects" />}</Route>
        <Route path="/assets">{() => <ModulePage moduleKey="assets" />}</Route>
        <Route path="/hr">{() => <ModulePage moduleKey="hr" />}</Route>
        <Route path="/audit">{() => <ModulePage moduleKey="audit" />}</Route>
        <Route path="/administration">{() => <ModulePage moduleKey="administration" />}</Route>
        <Route path="/settings">{() => <ModulePage moduleKey="settings" />}</Route>
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <RoutedApplication />
          <Toaster position="top-center" richColors />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
