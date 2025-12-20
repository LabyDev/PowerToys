import React, { ErrorInfo, ReactNode } from "react";
import {
  Button,
  Card,
  Text,
  Stack,
  Title,
  CopyButton,
  Tooltip,
} from "@mantine/core";
import { WarningCircleIcon, CopyIcon } from "@phosphor-icons/react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Error caught by ErrorBoundary:", error);
    console.error(errorInfo.componentStack);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      const errorDetails = `${this.state.error?.toString()}\n\n${
        this.state.errorInfo?.componentStack
      }`;

      const mailtoLink = `mailto:dev@example.com?subject=App%20Error%20Report&body=${encodeURIComponent(
        errorDetails,
      )}`;

      return (
        <Card shadow="sm" padding="lg" style={{ margin: 20 }}>
          <Stack gap="md" align="center" style={{ width: "100%" }}>
            <WarningCircleIcon size={48} color="red" weight="bold" />
            <Title order={2} style={{ color: "red" }}>
              Oops! Something went wrong.
            </Title>
            <Text style={{ textAlign: "center" }}>
              The app encountered an unexpected error. You can help us fix it by
              sending a report.
            </Text>

            <Button
              component="a"
              href={mailtoLink}
              color="red"
              variant="outline"
              target="_blank"
            >
              Send Error Report
            </Button>

            <CopyButton value={errorDetails}>
              {({ copied, copy }) => (
                <Tooltip label={copied ? "Copied!" : "Copy error details"}>
                  <Button
                    variant="light"
                    onClick={copy}
                    leftSection={<CopyIcon />}
                  >
                    Copy Error Details
                  </Button>
                </Tooltip>
              )}
            </CopyButton>

            {/* Show error details in scrollable box */}
            <pre
              style={{
                marginTop: 20,
                maxHeight: 300,
                overflow: "auto",
                width: "100%",
                backgroundColor: "#f8f8f8",
                padding: 10,
                borderRadius: 6,
                fontSize: 12,
              }}
            >
              {errorDetails}
            </pre>
          </Stack>
        </Card>
      );
    }

    return this.props.children;
  }
}
