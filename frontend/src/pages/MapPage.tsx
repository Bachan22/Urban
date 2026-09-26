import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Analysis from "./Analysis";
import type { BusinessType } from "../data/puneData";

export const MapPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const businessParam = (searchParams.get("business") ||
    searchParams.get("category") ||
    "Education Institute") as BusinessType;

  return (
    <div style={{ height: "calc(100vh - 120px)", margin: "-28px" }}>
      <Analysis
        initialBusinessType={businessParam}
        onBack={() => navigate("/dashboard")}
      />
    </div>
  );
};

export default MapPage;
