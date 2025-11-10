import { supabaseAdmin } from './supabase-admin'

/**
 * Grant (adiciona) setores a um usuário
 * Preserva setores existentes e adiciona novos sem duplicatas
 * 
 * @param {string} userId - UUID do usuário
 * @param {string[]} newSectors - Array de setores para adicionar
 * @returns {Promise<{success: boolean, sectors?: string[], error?: string}>}
 */
export async function grantSectorsToUser(userId, newSectors) {
  try {
    if (!userId) {
      console.error('[grantSectorsToUser] userId is required')
      return { success: false, error: 'userId is required' }
    }

    if (!Array.isArray(newSectors) || newSectors.length === 0) {
      console.warn('[grantSectorsToUser] No sectors to grant', { userId, newSectors })
      return { success: true, sectors: [] }
    }

    console.info('[grantSectorsToUser] Step 1: Getting user data', { userId })
    const { data: userData, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(userId)

    if (getUserError) {
      console.error('[grantSectorsToUser] Error getting user', { userId, error: getUserError })
      return { success: false, error: getUserError.message }
    }

    if (!userData || !userData.user) {
      console.error('[grantSectorsToUser] User not found', { userId })
      return { success: false, error: 'User not found' }
    }

    const user = userData.user
    console.info('[grantSectorsToUser] Step 2: User found', {
      userId,
      userEmail: user.email,
      currentMetadata: user.user_metadata
    })

    const meta = user.user_metadata || {}
    const currentSectors = Array.isArray(meta.sectors) ? meta.sectors : []
    const mergedSectors = Array.from(new Set([...currentSectors, ...newSectors]))

    console.info('[grantSectorsToUser] Step 3: Merging sectors', {
      userId,
      currentSectors,
      newSectors,
      mergedSectors
    })

    // Preserva todos os metadados existentes e atualiza apenas sectors
    const updatedMetadata = {
      ...meta,
      sectors: mergedSectors
    }

    console.info('[grantSectorsToUser] Step 4: Updating user metadata', {
      userId,
      updatedMetadata
    })

    const { data: updateData, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { user_metadata: updatedMetadata }
    )

    if (updateError) {
      console.error('[grantSectorsToUser] Error updating user', {
        userId,
        error: updateError,
        errorMessage: updateError.message
      })
      return { success: false, error: updateError.message }
    }

    console.info('[grantSectorsToUser] Step 5: SUCCESS!', {
      userId,
      grantedSectors: mergedSectors,
      updateResult: updateData
    })

    return { success: true, sectors: mergedSectors }
  } catch (e) {
    console.error('[grantSectorsToUser] Exception', {
      userId,
      error: e,
      errorMessage: e?.message,
      errorStack: e?.stack
    })
    return { success: false, error: e?.message || 'Unknown error' }
  }
}

/**
 * Aumenta o limite de usuários de uma empresa
 * 
 * @param {string} empresaId - UUID da empresa
 * @param {number} quantity - Quantidade de usuários a adicionar
 * @returns {Promise<{success: boolean, newLimit?: number, error?: string}>}
 */
export async function increaseUserLimit(empresaId, quantity) {
  try {
    if (!empresaId) {
      console.error('[increaseUserLimit] empresaId is required')
      return { success: false, error: 'empresaId is required' }
    }

    const qty = parseInt(quantity) || 0
    if (qty <= 0) {
      console.warn('[increaseUserLimit] Invalid quantity', { empresaId, quantity })
      return { success: true, newLimit: 0 }
    }

    console.info('[increaseUserLimit] Step 1: Getting current limit', { empresaId, quantity: qty })
    const { data: empresaData, error: getError } = await supabaseAdmin
      .from('empresa')
      .select('user_limit')
      .eq('id', empresaId)
      .single()

    if (getError) {
      console.error('[increaseUserLimit] Error getting empresa', { empresaId, error: getError })
      return { success: false, error: getError.message }
    }

    const currentLimit = parseInt(empresaData?.user_limit) || 0
    const newLimit = currentLimit + qty

    console.info('[increaseUserLimit] Step 2: Updating limit', {
      empresaId,
      currentLimit,
      addQuantity: qty,
      newLimit
    })

    const { error: updateError } = await supabaseAdmin
      .from('empresa')
      .update({ user_limit: newLimit })
      .eq('id', empresaId)

    if (updateError) {
      console.error('[increaseUserLimit] Error updating empresa', { empresaId, error: updateError })
      return { success: false, error: updateError.message }
    }

    console.info('[increaseUserLimit] Step 3: SUCCESS!', {
      empresaId,
      previousLimit: currentLimit,
      newLimit
    })

    return { success: true, newLimit }
  } catch (e) {
    console.error('[increaseUserLimit] Exception', {
      empresaId,
      error: e,
      errorMessage: e?.message
    })
    return { success: false, error: e?.message || 'Unknown error' }
  }
}

/**
 * Obtém a empresa de um usuário
 * 
 * @param {string} userId - UUID do usuário
 * @returns {Promise<{success: boolean, empresaId?: string, error?: string}>}
 */
export async function getUserEmpresa(userId) {
  try {
    if (!userId) {
      return { success: false, error: 'userId is required' }
    }

    const { data, error } = await supabaseAdmin
      .from('empresa_users')
      .select('empresa_id')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      console.error('[getUserEmpresa] Error', { userId, error })
      return { success: false, error: error.message }
    }

    if (!data?.empresa_id) {
      console.warn('[getUserEmpresa] User not linked to empresa', { userId })
      return { success: false, error: 'User not linked to empresa' }
    }

    return { success: true, empresaId: data.empresa_id }
  } catch (e) {
    console.error('[getUserEmpresa] Exception', { userId, error: e })
    return { success: false, error: e?.message || 'Unknown error' }
  }
}
