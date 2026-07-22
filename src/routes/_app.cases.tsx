import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/cases")({
  component: () => <Outlet />,
});