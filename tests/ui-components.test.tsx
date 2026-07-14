import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { MetricPill } from "../src/components/MetricPill";
import { MessageBubble } from "../src/components/MessageBubble";
import { Kpi } from "../src/components/Kpi";

describe("UI Components", () => {
  it("renders MetricPill correctly", () => {
    render(<MetricPill label="Occupancy" value="85%" />);
    expect(screen.getByText("Occupancy")).toBeInTheDocument();
    expect(screen.getByText("85%")).toBeInTheDocument();
  });

  it("renders user MessageBubble correctly", () => {
    render(
      <MessageBubble
        message={{
          id: "1",
          role: "user",
          parts: [{ type: "text", text: "Hello from user" }],
        }}
      />,
    );
    expect(screen.getByText("Hello from user")).toBeInTheDocument();
  });

  it("renders assistant MessageBubble with Markdown", () => {
    render(
      <MessageBubble
        message={{
          id: "2",
          role: "assistant",
          parts: [{ type: "text", text: "**Bold text**" }],
        }}
      />,
    );
    expect(screen.getByText("Bold text")).toBeInTheDocument();
    // The markdown bold text will be inside a strong tag, so it renders 'Bold text'
  });

  it("renders Kpi correctly", () => {
    render(<Kpi label="Energy" value="500 kWh" accent="warn" />);
    expect(screen.getByText("Energy")).toBeInTheDocument();
    expect(screen.getByText("500 kWh")).toBeInTheDocument();
  });
});
