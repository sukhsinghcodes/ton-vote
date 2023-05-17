import { styled } from "@mui/material";
import { AppTooltip, Button, Img } from "components";
import { DevParametersModal } from "components/DevParameters";
import { IS_DEV } from "config";
import { useConnection } from "ConnectionProvider";
import { TOOLBAR_WIDTH } from "consts";
import { useMobile } from "hooks";
import { useDaosPageTranslations } from "i18n/hooks/useDaosPageTranslations";
import { useDaosQuery } from "query/getters";
import { AiOutlinePlus } from "react-icons/ai";
import { Link, useParams } from "react-router-dom";
import { appNavigation, useAppNavigation } from "router/navigation";
import { StyledFlexColumn } from "styles";
import { isOwner, parseLanguage } from "utils";

export function Toolbar() {
  const navigation = useAppNavigation();
  const translations = useDaosPageTranslations();

  const mobile = useMobile();

  if (mobile) return null;

  return (
    <StyledToolbar>
      <StyledFlexColumn gap={20}>
        <DevParametersModal />
        <AppTooltip
          text={IS_DEV ? translations.createDao : `${translations.createDao} (comming soon)`}
          placement="right"
        >
          <StyledButton
          disabled={!IS_DEV}
            onClick={IS_DEV ? navigation.createSpace.root : () => {}}
            variant="transparent"
          >
            <AiOutlinePlus />
          </StyledButton>
        </AppTooltip>
      </StyledFlexColumn>
      <UserDaos />
    </StyledToolbar>
  );
}

const StyledButton = styled(Button)({
  borderRadius: "50%",
  cursor: "pointer",
  padding: 10,
  width: 40,
  height: 40,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  svg: {
    width: 20,
    height: 20,
  },
});

const StyledToolbar = styled(StyledFlexColumn)({
  width: TOOLBAR_WIDTH,
  height: "100%",
  background: "white",
  position: "fixed",
  left: 0,
  borderRight: "0.5px solid rgba(114, 138, 150, 0.24)",
  zIndex: 30,
  top: 0,
  justifyContent: "flex-start",
  paddingTop: 20,
  gap: 0,
});

const UserDaos = () => {
  const { data: daos } = useDaosQuery();
  const connectedWallet = useConnection().address;

  const daoId = useParams().daoId;

  if (!connectedWallet) {
    return null;
  }

  return (
    <StyledUserDaos>
      {daos &&
        daos?.map((dao) => {
          if (isOwner(connectedWallet, dao.daoRoles)) {
            const selected = daoId === dao.daoAddress;
            return (
              <StyledLink
                selected={selected ? 1 : 0}
                to={appNavigation.daoPage.root(dao.daoAddress)}
                key={dao.daoAddress}
              >
                <AppTooltip
                  text={parseLanguage(dao.daoMetadata.name)}
                  placement="right"
                >
                  <StyledDaoImg src={dao.daoMetadata.avatar} />
                </AppTooltip>
              </StyledLink>
            );
          }
          return null;
        })}
    </StyledUserDaos>
  );
};

const StyledLink = styled(Link)<{ selected: number }>(({ selected }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 5,
  transition: "0.2s all",
  boxShadow: selected === 1 ? "0px -1px 24px 4px rgba(0,136,204,1)" : "unset",
  borderRadius: "50%",
}));

const StyledDaoImg = styled(Img)({
  width: 40,
  height: 40,
  borderRadius: "50%",
});

const StyledUserDaos = styled(StyledFlexColumn)({
  flex: 1,
  gap: 20,
  overflow: "auto",
  paddingBottom: 50,
  justifyContent: "flex-start",
  paddingTop: 20,
});
