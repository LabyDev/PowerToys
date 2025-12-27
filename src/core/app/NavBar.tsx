import {
  Burger,
  Container,
  Group,
  Button,
  useMantineColorScheme,
  NavLink,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { CaretLeftIcon, GearSixIcon } from "@phosphor-icons/react";
import classes from "./NavBar.module.css";
import { useTranslation } from "react-i18next";

export function NavBar() {
  const [opened, { toggle }] = useDisclosure(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { colorScheme } = useMantineColorScheme();
  const { t } = useTranslation();

  const handleGoBack = () => {
    navigate(-1);
  };

  const isFileRandomiser = location.pathname === "/FileRandomiser";

  return (
    <header className={classes.header} data-theme={colorScheme}>
      <Container fluid className={classes.inner}>
        <Group gap="sm" visibleFrom="xs" className={classes["no-wrap-group"]}>
          {/* Back Button */}
          <Button
            variant="subtle"
            leftSection={<CaretLeftIcon size={20} weight="bold" />}
            onClick={handleGoBack}
          >
            {t("navbar.goBack")}
          </Button>

          {/* Home NavLink */}
          <NavLink
            className={classes.link}
            component={Link}
            to="/"
            label={t("navbar.home")}
            active
          />

          {/* Settings button shown only on FileRandomiser */}
          {isFileRandomiser && (
            <Button
              variant="subtle"
              leftSection={<GearSixIcon size={16} />}
              component={Link}
              to="/FileRandomiserSettings"
              className="nav-settings-btn"
            >
              {t("navbar.settings")}
            </Button>
          )}
        </Group>

        <Burger opened={opened} onClick={toggle} hiddenFrom="xs" size="sm" />
      </Container>
    </header>
  );
}
