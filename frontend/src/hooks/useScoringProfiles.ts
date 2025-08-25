import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fantasyAPI, ScoringProfile } from '../api';

// Query keys for caching
export const scoringProfileKeys = {
  all: ['scoringProfiles'] as const,
  lists: () => [...scoringProfileKeys.all, 'list'] as const,
  list: () => [...scoringProfileKeys.lists()] as const,
  details: () => [...scoringProfileKeys.all, 'detail'] as const,
  detail: (id: string) => [...scoringProfileKeys.details(), id] as const,
};

// Hook for getting all scoring profiles
export const useScoringProfiles = () => {
  return useQuery({
    queryKey: scoringProfileKeys.list(),
    queryFn: () => fantasyAPI.getProfiles(),
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
};

// Hook for getting a specific scoring profile
export const useScoringProfile = (profileId: string) => {
  return useQuery({
    queryKey: scoringProfileKeys.detail(profileId),
    queryFn: () => fantasyAPI.getProfile(profileId),
    enabled: !!profileId,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
};

// Hook for creating a scoring profile
export const useCreateScoringProfile = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (profile: Omit<ScoringProfile, 'profile_id' | 'created_at'>) =>
      fantasyAPI.createProfile(profile),
    onSuccess: () => {
      // Invalidate and refetch scoring profiles list
      queryClient.invalidateQueries({ queryKey: scoringProfileKeys.lists() });
    },
  });
};

// Hook for updating a scoring profile
export const useUpdateScoringProfile = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ profileId, profile }: { profileId: string; profile: Omit<ScoringProfile, 'profile_id' | 'created_at'> }) =>
      fantasyAPI.updateProfile(profileId, profile),
    onSuccess: (_, { profileId }) => {
      // Invalidate and refetch specific profile and list
      queryClient.invalidateQueries({ queryKey: scoringProfileKeys.detail(profileId) });
      queryClient.invalidateQueries({ queryKey: scoringProfileKeys.lists() });
    },
  });
};

// Hook for deleting a scoring profile
export const useDeleteScoringProfile = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (profileId: string) => fantasyAPI.deleteProfile(profileId),
    onSuccess: () => {
      // Invalidate and refetch scoring profiles list
      queryClient.invalidateQueries({ queryKey: scoringProfileKeys.lists() });
    },
  });
};

// Hook for getting default scoring profiles (Standard, PPR, etc.)
export const useDefaultScoringProfiles = () => {
  return useQuery({
    queryKey: scoringProfileKeys.list(),
    queryFn: () => fantasyAPI.getProfiles(),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    select: (profiles) => profiles.filter(profile => profile.is_public),
  });
};

// Hook for getting a specific default profile by name
export const useDefaultProfileByName = (profileName: string) => {
  return useQuery({
    queryKey: scoringProfileKeys.list(),
    queryFn: () => fantasyAPI.getProfiles(),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    select: (profiles) => profiles.find(profile => 
      profile.name.toLowerCase().includes(profileName.toLowerCase()) && profile.is_public
    ),
  });
};
