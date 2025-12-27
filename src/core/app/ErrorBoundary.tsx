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
import { useTranslation } from "react-i18next";

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
      const githubIssuesLink = "https://github.com/LabyDev/PowerToys/issues";

      return (
        <ErrorBoundaryInner
          errorDetails={errorDetails}
          githubIssuesLink={githubIssuesLink}
        />
      );
    }

    return this.props.children;
  }
}

// Functional wrapper to use hooks inside class component
function ErrorBoundaryInner({
  errorDetails,
  githubIssuesLink,
}: {
  errorDetails: string;
  githubIssuesLink: string;
}) {
  const { t } = useTranslation();

  return (
    <Card shadow="sm" padding="lg" style={{ margin: 20 }}>
      <Stack gap="md" align="center" style={{ width: "100%" }}>
        <WarningCircleIcon size={48} color="red" weight="bold" />
        <Title order={2} style={{ color: "red" }}>
          {t("errorBoundary.title")}
        </Title>
        <Text style={{ textAlign: "center" }}>
          {t("errorBoundary.description")}
        </Text>

        <Button
          component="a"
          href={githubIssuesLink}
          color="red"
          variant="outline"
          target="_blank"
        >
          {t("errorBoundary.reportButton")}
        </Button>

        <CopyButton value={errorDetails}>
          {({ copied, copy }) => (
            <Tooltip
              label={
                copied
                  ? t("errorBoundary.copiedTooltip")
                  : t("errorBoundary.copyTooltip")
              }
            >
              <Button variant="light" onClick={copy} leftSection={<CopyIcon />}>
                {t("errorBoundary.copyButton")}
              </Button>
            </Tooltip>
          )}
        </CopyButton>

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
