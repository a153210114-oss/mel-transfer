const { awardUsagePoint, getUsagePointRule, FALLBACK_RULES } = require('./points-ledger');

function cleanCode(value = '') {
  return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '').trim().toUpperCase();
}

function cleanText(value = '', max = 240) {
  return String(value || '').replace(/\u0000/g, '').trim().slice(0, max);
}

const SCENARIO_ACTIONS = {
  phone_verified: {
    actionKey: 'phone_signup_verified',
    reason: '完成手机号验证注册'
  },
  profile_saved: {
    actionKey: 'profile_completed',
    reason: '完善个人资料'
  },
  card_saved: {
    actionKey: 'profile_card_created',
    reason: '保存并生成个人名片'
  },
  card_shared: {
    actionKey: 'card_first_shared',
    reason: '分享自己的华伴名片'
  },
  service_profile_saved: {
    actionKey: 'service_card_completed',
    reason: '保存服务名片并进入供给资料'
  },
  local_need_saved: {
    actionKey: 'local_need_structured',
    reason: 'AI 整理并保存真实本地需求'
  },
  service_completion_confirmed: {
    actionKey: 'service_completion_confirmed',
    reason: '双方确认完成一次真实服务',
    currentStage: 'deferred'
  },
  direct_referral_joined: {
    actionKey: 'direct_referral_verified',
    reason: '好友通过分享进入并完成手机号验证'
  },
  second_level_referral_joined: {
    actionKey: 'second_level_referral_verified',
    reason: '二级好友真实加入华伴'
  }
};

async function pointRule(actionKey = '') {
  const key = cleanText(actionKey, 80);
  return await getUsagePointRule(key).catch(() => null) || FALLBACK_RULES[key] || null;
}

async function emitScenarioPoint({
  scenarioKey = '',
  actorCode = '',
  relatedCode = '',
  source = 'scenario_events',
  reason = '',
  fields = {}
} = {}) {
  const scenario = SCENARIO_ACTIONS[scenarioKey];
  const owner = cleanCode(actorCode);
  if (!scenario) return { skipped: true, reason: 'unknown_scenario', scenario_key: scenarioKey };
  if (scenario.currentStage === 'deferred') {
    return { skipped: true, reason: 'scenario_deferred_for_current_stage', scenario_key: scenarioKey };
  }
  if (!owner) return { skipped: true, reason: 'missing_actor_code', scenario_key: scenarioKey };
  const point = await awardUsagePoint({
    ownerCode: owner,
    actionKey: scenario.actionKey,
    relatedCode: relatedCode || owner,
    reason: reason || scenario.reason,
    source,
    fields: {
      scenario_key: scenarioKey,
      scenario_action_key: scenario.actionKey,
      ...fields
    }
  });
  return {
    scenario_key: scenarioKey,
    action_key: scenario.actionKey,
    point
  };
}

async function handlePhoneVerifiedScenario({
  ownerCode = '',
  accountUid = '',
  phone = '',
  source = 'phone_verified',
  fields = {}
} = {}) {
  return emitScenarioPoint({
    scenarioKey: 'phone_verified',
    actorCode: ownerCode,
    relatedCode: accountUid || phone || ownerCode,
    source,
    fields: {
      account_uid: accountUid || '',
      normalized_phone: phone || '',
      ...fields
    }
  });
}

async function handleProfileSavedScenario({
  ownerCode = '',
  accountUid = '',
  phone = '',
  name = '',
  industry = '',
  source = 'profile_saved',
  fields = {}
} = {}) {
  const cleanedName = cleanText(name, 80);
  const cleanedIndustry = cleanText(industry, 80);
  const hasUsefulProfile = Boolean(cleanedName || cleanedIndustry);
  if (!hasUsefulProfile) return { skipped: true, reason: 'profile_not_useful' };
  return emitScenarioPoint({
    scenarioKey: 'profile_saved',
    actorCode: ownerCode,
    relatedCode: accountUid || phone || ownerCode,
    source,
    fields: {
      account_uid: accountUid || '',
      normalized_phone: phone || '',
      has_name: Boolean(cleanedName),
      has_industry: Boolean(cleanedIndustry),
      ...fields
    }
  });
}

async function handleCardSavedScenario({
  ownerCode = '',
  accountUid = '',
  phone = '',
  source = 'card_saved',
  fields = {}
} = {}) {
  return emitScenarioPoint({
    scenarioKey: 'card_saved',
    actorCode: ownerCode,
    relatedCode: accountUid || phone || ownerCode,
    source,
    fields: {
      account_uid: accountUid || '',
      normalized_phone: phone || '',
      ...fields
    }
  });
}

async function handleCardSharedScenario({
  ownerCode = '',
  accountUid = '',
  shareUrl = '',
  source = 'card_shared',
  fields = {}
} = {}) {
  return emitScenarioPoint({
    scenarioKey: 'card_shared',
    actorCode: ownerCode,
    relatedCode: accountUid || shareUrl || ownerCode,
    source,
    fields: {
      account_uid: accountUid || '',
      share_url: shareUrl || '',
      ...fields
    }
  });
}

async function handleServiceProfileSavedScenario({
  ownerCode = '',
  supplyProfileId = '',
  supplierCode = '',
  source = 'service_profile_saved',
  fields = {}
} = {}) {
  return emitScenarioPoint({
    scenarioKey: 'service_profile_saved',
    actorCode: ownerCode,
    relatedCode: supplyProfileId || supplierCode || ownerCode,
    source,
    fields: {
      supply_profile_id: supplyProfileId || '',
      supplier_code: supplierCode || '',
      audit_mode: 'review_required',
      ...fields
    }
  });
}

async function handleLocalNeedSavedScenario({
  ownerCode = '',
  demandId = '',
  rawText = '',
  source = 'local_need_saved',
  fields = {}
} = {}) {
  return emitScenarioPoint({
    scenarioKey: 'local_need_saved',
    actorCode: ownerCode,
    relatedCode: demandId || rawText || ownerCode,
    source,
    fields
  });
}

async function handleReferralVerifiedScenario({
  inviterCode = '',
  refereeCode = '',
  secondLevelCode = '',
  directEligible = true,
  secondEligible = false,
  source = 'referral_verified',
  fields = {}
} = {}) {
  const directRule = await pointRule('direct_referral_verified');
  const secondRule = await pointRule('second_level_referral_verified');
  const direct = directEligible
    ? await emitScenarioPoint({
        scenarioKey: 'direct_referral_joined',
        actorCode: inviterCode,
        relatedCode: refereeCode,
        source,
        fields: { ...fields, ref_level: 1 }
      })
    : null;
  const second = secondEligible
    ? await emitScenarioPoint({
        scenarioKey: 'second_level_referral_joined',
        actorCode: secondLevelCode,
        relatedCode: refereeCode,
        source,
        fields: { ...fields, ref_level: 2 }
      })
    : null;
  return {
    direct,
    second,
    rules: {
      direct: directRule,
      second: secondRule
    }
  };
}

async function handleServiceCompletionConfirmedScenario({
  requesterCode = '',
  providerCode = '',
  conversationId = '',
  demandId = '',
  serviceType = '',
  city = '',
  source = 'service_completion_confirmed',
  fields = {}
} = {}) {
  const requester = cleanCode(requesterCode);
  const provider = cleanCode(providerCode);
  const relatedBase = cleanText(conversationId || demandId || `${requester}:${provider}:${serviceType}`, 120);
  const sharedFields = {
    requester_code: requester,
    provider_code: provider,
    conversation_id: conversationId || '',
    demand_id: demandId || '',
    service_type: cleanText(serviceType, 120),
    city: cleanText(city, 80),
    review_required_reason: '双方确认完成，但仍需防刷、投诉和异常频率复核。',
    anti_abuse: {
      same_conversation_once: true,
      both_sides_required: true,
      daily_limit_per_user: 3,
      monthly_limit_per_user: 30,
      status: 'pending_review'
    },
    ...fields
  };
  const requesterPoint = requester
    ? await emitScenarioPoint({
        scenarioKey: 'service_completion_confirmed',
        actorCode: requester,
        relatedCode: `${relatedBase}:REQUESTER`,
        source,
        fields: { ...sharedFields, role: 'requester' }
      })
    : null;
  const providerPoint = provider
    ? await emitScenarioPoint({
        scenarioKey: 'service_completion_confirmed',
        actorCode: provider,
        relatedCode: `${relatedBase}:PROVIDER`,
        source,
        fields: { ...sharedFields, role: 'provider' }
      })
    : null;
  return { requester: requesterPoint, provider: providerPoint };
}

module.exports = {
  handlePhoneVerifiedScenario,
  handleProfileSavedScenario,
  handleCardSavedScenario,
  handleCardSharedScenario,
  handleServiceProfileSavedScenario,
  handleLocalNeedSavedScenario,
  handleReferralVerifiedScenario,
  handleServiceCompletionConfirmedScenario,
  pointRule,
  SCENARIO_ACTIONS
};
