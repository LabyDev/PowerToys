import { Card, Flex, Image, Button, Stack } from "@mantine/core";
import {
  ShuffleIcon,
  SortAscendingIcon,
  GearSixIcon,
} from "@phosphor-icons/react";
import { NavLink } from "react-router";
import { useTranslation } from "react-i18next";
import "./MainPage.css";

function App() {
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
        {/* Logo Container */}
        <Flex justify="center" mb="xl">
          <Image
            src="/powertoys.svg"
            alt="Laby's Powertoys Logo"
            w={200} // Adjust width as needed
            fit="contain"
          />
        </Flex>

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
            to="/FileSorter"
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
