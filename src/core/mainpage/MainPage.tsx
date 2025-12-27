import { Card, Title, Button, Stack, useMantineTheme } from "@mantine/core";
import {
  ShuffleIcon,
  SortAscendingIcon,
  GearSixIcon,
} from "@phosphor-icons/react";
import { NavLink } from "react-router";
import { useTranslation } from "react-i18next";
import "./MainPage.css";

function App() {
  const theme = useMantineTheme();
  const { t } = useTranslation();

  return (
    <div className="wrapper">
      <Card
        shadow="lg"
        padding="xl"
        radius="md"
        withBorder
        className="main-card"
      >
        <Title
          style={{ textAlign: "center", marginBottom: theme.spacing.xl }}
          order={1}
        >
          {t("mainPage.appTitle")}
        </Title>

        <Stack gap="md" style={{ width: "100%" }}>
          <Button
            fullWidth
            component={NavLink}
            to="/FileRandomiser"
            leftSection={<ShuffleIcon />}
          >
            {t("mainPage.fileRandomiserButton")}
          </Button>

          <Button
            fullWidth
            component={NavLink}
            to="/sorter"
            leftSection={<SortAscendingIcon />}
          >
            {t("mainPage.fileSorterButton")}
          </Button>

          <Button
            variant="subtle"
            component={NavLink}
            to="/Settings"
            leftSection={<GearSixIcon />}
          >
            {t("mainPage.settingsButton")}
          </Button>
        </Stack>
      </Card>
    </div>
  );
}

export default App;
