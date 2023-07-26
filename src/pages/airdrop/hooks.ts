import { useMutation, useQuery } from "@tanstack/react-query";
import { useTonAddress, useTonConnectUI } from "@tonconnect/ui-react";
import { useFormik } from "formik";
import { useDebouncedCallback, useFormatNumber } from "hooks/hooks";
import _ from "lodash";
import {
  useGetAllProposalsCallback,
  useGetClientsCallback,
  useGetWalletNFTCollectionItemsCallback,
  useReadJettonWalletMedataCallback,
} from "query/getters";
import { useEffect, useMemo } from "react";
import { showSuccessToast, useErrorToast } from "toasts";
import { toNano } from "ton-core";
import {
  chooseRandomVoters,
  transferJettons,
  transferNft,
} from "ton-vote-contracts-sdk";
import { AnyObjectSchema } from "yup";
import { useAirdropStore, AirdropForm } from "./store";
import { AirdropStoreKeys, VoterSelectionMethod } from "./types";

export const useAirdropVotersQuery = () => {
  const getVotes = useGetAirdropVotes();

  return useQuery(["useAirdropVotersQuery"], async () => {
    const votes = await getVotes();
    return _.keys(votes);
  });
};

export const useGetAirdropVotes = () => {
  const getProposals = useGetAllProposalsCallback();
  const { proposals } = useAirdropStore();

  return async () => {
    const result = await getProposals(proposals);

    let votes = {};
    result.forEach((proposal) => {
      votes = {
        ...votes,
        ...proposal?.rawVotes,
      };
    });

    return votes;
  };
};

export const useVotersSelectSubmit = () => {
  const errorToast = useErrorToast();
  const {
    setValues,
    nextStep,
    manuallySelectedVoters = [],
  } = useAirdropStore();
  const getVotes = useGetAirdropVotes();
  const getClients = useGetClientsCallback();

  return useMutation(
    async (formData: AirdropForm) => {
      if (formData.selectionMethod === VoterSelectionMethod.MANUALLY) {
        return manuallySelectedVoters;
      }

      const votes = await getVotes();

      if (formData.selectionMethod === VoterSelectionMethod.ALL) {
        return _.keys(votes);
      }

      if (!formData.votersAmount) {
        throw new Error("Random voters amount is required");
      }
      const clientV4 = (await getClients()).clientV4;

      if (!votes) {
        throw new Error("Something went wrong");
      }

      if (_.size(votes) < formData.votersAmount) {
        throw new Error(
          `Max amount of voters in ${_.size(votes).toLocaleString()}`
        );
      }

      const result = await chooseRandomVoters(
        clientV4,
        votes,
        formData.votersAmount
      );

      if (_.size(result) === 0) {
        throw new Error("Something went wrong");
      }
      return result;
    },
    {
      onSuccess: (voters, args) => {
        setValues({
          voters,
        });
        nextStep();
      },
      onError: (error) => {
        errorToast(error);
      },
    }
  );
};

export const useAmountPerWallet = () => {
  const { jettonsAmount, assetType, voters } = useAirdropStore();

  const amountPerWallet = useMemo(() => {
    const amount = jettonsAmount || 0;

    return assetType === "jetton" ? Math.floor(amount / _.size(voters)) : 1;
  }, [jettonsAmount, _.size(voters), assetType]);

  const amountPerWalletUI = useFormatNumber(amountPerWallet);

  return { amountPerWallet, amountPerWalletUI };
};

export const useAmount = () => {
  const { jettonsAmount, assetType, voters } = useAirdropStore();

  const amount = useMemo(() => {
    return assetType === "jetton" ? jettonsAmount : _.size(voters);
  }, [jettonsAmount, _.size(voters), assetType]);

  const amountUI = useFormatNumber(amount);

  return { amount, amountUI };
};

export const useNextVoter = () => {
  const { currentWalletIndex, voters } = useAirdropStore();
  return !voters ? undefined : voters[currentWalletIndex || 0];
};

export const useTransferJetton = () => {
  const { amountPerWallet } = useAmountPerWallet();
  const { jettonAddress } = useAirdropStore();
  const errorToast = useErrorToast();
  const [tonconnect] = useTonConnectUI();
  const onSuccess = useOnTransferSuccess();
  const nextVoter = useNextVoter();
  const getClients = useGetClientsCallback();

  return useMutation(
    async () => {
      if (!jettonAddress) {
        throw new Error("No jetton address found");
      }
      const clientV2 = (await getClients()).clientV2;
      if (!nextVoter) {
        throw new Error("No next voter found");
      }
      return transferJettons(
        clientV2,
        tonconnect,
        toNano(amountPerWallet),
        jettonAddress,
        nextVoter
      );
    },
    {
      onSuccess: async (args) => {
        showSuccessToast(`Successfully transfered jetton`);
        onSuccess();
      },
      onError: (error) => {
        errorToast(error);
      },
    }
  );
};

const useOnTransferSuccess = () => {
  const {
    incrementCurrentWalletIndex,
    nextStep,
    currentWalletIndex = 0,
    voters,
  } = useAirdropStore();

  return () => {
    incrementCurrentWalletIndex();
    if (currentWalletIndex + 1 >= _.size(voters)) {
      nextStep();
    }
  };
};

export const useTransferNFT = () => {
  const errorToast = useErrorToast();
  const [tonconnect] = useTonConnectUI();
  const onSuccess = useOnTransferSuccess();
  const voter = useNextVoter();
  const getClients = useGetClientsCallback();
  const { setNFTItemsRecipients } = useAirdropStore();

  return useMutation(
    async (nftCollection: string) => {
      if (!voter) {
        throw new Error("No next voter found");
      }
      // const clientV2 = (await getClients()).clientV2;
      // return transferNft(clientV2, tonconnect, nftCollection, voter);
    },
    {
      onSuccess: (_, nftCollection) => {
        showSuccessToast(`Successfully transferred NFT`);
        onSuccess();
        setNFTItemsRecipients(voter!, nftCollection);
      },
      onError: (error) => {
        errorToast(error);
      },
    }
  );
};

export const useOnAssetTypeSelected = () => {
  const getMetadata = useReadJettonWalletMedataCallback();
  const showError = useErrorToast();
  const connectedWallet = useTonAddress();
  const { nextStep } = useAirdropStore();
  const getWalletNFTCollectionItems = useGetWalletNFTCollectionItemsCallback();

  return useMutation(
    async (values: AirdropForm) => {
      if (values.assetType === "jetton") {
        if (!values.jettonAddress) {
          throw new Error("No jetton address found");
        }
        const metadata = await getMetadata(values.jettonAddress);
        if (metadata.ownerAddress.toString() !== connectedWallet) {
          throw new Error("You are not the owner of this jetton");
        }
      } else {
        if (!values.nftCollection) {
          throw new Error("No NFT address found");
        }
      }
    },
    {
      onSuccess: () => {
        nextStep();
      },
      onError: (err) => {
        showError(err);
      },
    }
  );
};

export const useAirdropFormik = (
  onSubmit: (value: AirdropForm) => void,
  schema: AnyObjectSchema
) => {
  const {
    voters,
    jettonsAmount,
    jettonAddress,
    assetType,
    selectionMethod,
    nftCollection,
    manuallySelectedVoters,
    setValues,
  } = useAirdropStore();
  const formik = useFormik<AirdropForm>({
    initialValues: {
      [AirdropStoreKeys.votersAmount]: _.size(voters) || undefined,
      [AirdropStoreKeys.jettonsAmount]: jettonsAmount,
      [AirdropStoreKeys.jettonAddress]: jettonAddress,
      [AirdropStoreKeys.nftCollection]: nftCollection,
      [AirdropStoreKeys.assetType]: assetType,
      [AirdropStoreKeys.selectionMethod]: selectionMethod,
      [AirdropStoreKeys.manuallySelectedVoters]: manuallySelectedVoters || [],
    },
    validationSchema: schema,
    validateOnChange: false,
    validateOnBlur: true,
    onSubmit: (values) => {
      onSubmit(values);
    },
  });

  const saveForm = useDebouncedCallback(() => {
    setValues(formik.values);
  });

  useEffect(() => {
    saveForm();
  }, [formik.values]);

  return formik;
};
