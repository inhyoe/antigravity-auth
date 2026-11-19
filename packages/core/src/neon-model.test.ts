import { describe, expect, it } from 'bun:test'
import {
  getAgyNativeModel,
  getAntigravityOpencodeModelIds,
  getGeminiNeonAntigravityModel,
  getPublicModelDefinitions,
  getQuotaGroupForModel,
  isGeminiCarbonModel,
  isGeminiHydrogenModel,
  isGeminiNeonModel,
  isRetiredAgyModel,
} from './model-registry.ts'
import { applyAgyNativeGenerationConfig } from './transform/agy-generation.ts'
import {
  resolveModelWithTier,
  resolveModelWithVariant,
} from './transform/model-resolver.ts'

// Route enums and thinking levels: fetchAvailableModels catalog on the daily
// endpoint for an Ultra account (19 Nov 2026): low M534 (1), medium M533 (2),
// high M532 (3, defaultAgentModelId), xhigh M535 (100).
describe('Gemini 4 Neon', () => {
  it('resolves all four routes with high as the default and host variant overrides', () => {
    for (const prefix of ['', 'antigravity-']) {
      expect(resolveModelWithTier(`${prefix}gemini-4-neon`)).toMatchObject({
        actualModel: 'gemini-4-neon-high',
        thinkingLevel: 'high',
        tier: 'high',
        isThinkingModel: true,
      })
      for (const tier of ['low', 'medium', 'high', 'xhigh'] as const) {
        expect(resolveModelWithTier(`${prefix}gemini-4-neon-${tier}`)).toMatchObject(
          {
            actualModel: `gemini-4-neon-${tier}`,
            thinkingLevel: tier,
            tier,
            isThinkingModel: true,
          },
        )
        for (const source of ['low', 'medium', 'high', 'xhigh']) {
          expect(
            resolveModelWithVariant(`${prefix}gemini-4-neon-${source}`, {
              thinkingLevel: tier,
            }),
          ).toMatchObject({
            actualModel: `gemini-4-neon-${tier}`,
            thinkingLevel: tier,
            tier,
            configSource: 'variant',
          })
        }
      }
    }
    expect(getGeminiNeonAntigravityModel()).toBe('gemini-4-neon-high')
  })

  it('registers the catalog server routes and keeps the ordinary Gemini quota pool', () => {
    for (const [tier, displayTier, modelEnum] of [
      ['low', 'Low', 'MODEL_PLACEHOLDER_M534'],
      ['medium', 'Medium', 'MODEL_PLACEHOLDER_M533'],
      ['high', 'High', 'MODEL_PLACEHOLDER_M532'],
      ['xhigh', 'XHigh', 'MODEL_PLACEHOLDER_M535'],
    ] as const) {
      const route = `gemini-4-neon-${tier}`
      expect(getAgyNativeModel(route)).toEqual({
        displayName: `Gemini 4 Neon (${displayTier})`,
        maxTokens: 1048576,
        maxOutputTokens: 262144,
        model: modelEnum,
        supportsThinking: true,
      })
      for (const id of [route, `antigravity-${route}`]) {
        expect(isRetiredAgyModel(id)).toBe(false)
        expect(getQuotaGroupForModel(id)).toBe('gemini')
        expect(getQuotaGroupForModel(id, true)).toBe('gemini')
      }
    }
  })

  it('publishes the Neon selector with exactly four effort variants', () => {
    expect(getAntigravityOpencodeModelIds()).toContain('antigravity-gemini-4-neon')
    const model = getPublicModelDefinitions()['antigravity-gemini-4-neon']
    expect(model).toMatchObject({
      name: 'Gemini 4 Neon (Antigravity)',
      reasoning: true,
      limit: { context: 1048576, output: 262144 },
    })
    expect(model?.variants).toEqual({
      low: { thinkingLevel: 'low' },
      medium: { thinkingLevel: 'medium' },
      high: { thinkingLevel: 'high' },
      xhigh: { thinkingLevel: 'xhigh' },
    })
  })

  it('recognizes only the public selector and the four routes', () => {
    for (const id of [
      'gemini-4-neon',
      'antigravity-gemini-4-neon',
      'gemini-4-neon-low',
      'Gemini-4-Neon-XHigh',
    ]) {
      expect(isGeminiNeonModel(id)).toBe(true)
    }
    for (const id of [
      'gemini-4-neon-disabled',
      'gemini-4-neonx',
      'antigravity-gemini-4-neon-ultra',
      'gemini-4-neon-minimal',
      'gemini-4-hydrogen-high',
      'gemini-4-carbon-high',
    ]) {
      expect(isGeminiNeonModel(id)).toBe(false)
    }
    // Neighbouring families do not claim Neon routes.
    expect(isGeminiHydrogenModel('gemini-4-neon-high')).toBe(false)
    expect(isGeminiCarbonModel('gemini-4-neon-high')).toBe(false)
    expect(getAgyNativeModel('gemini-4-neon-disabled')).toBeUndefined()
  })

  it('sends Hydrogen-style wire configs: LOW, MEDIUM, HIGH and numeric 100 for XHigh', () => {
    for (const [tier, thinkingLevel] of [
      ['low', 'LOW'],
      ['medium', 'MEDIUM'],
      ['high', 'HIGH'],
      ['xhigh', 100],
    ] as const) {
      const config: Record<string, unknown> = {}
      applyAgyNativeGenerationConfig(`gemini-4-neon-${tier}`, config)
      expect(JSON.parse(JSON.stringify(config))).toEqual({
        maxOutputTokens: 262144,
        thinkingConfig: { includeThoughts: true, thinkingLevel },
      })
    }
  })

  it('leaves Carbon and Hydrogen routing unchanged', () => {
    expect(resolveModelWithTier('gemini-4-carbon').actualModel).toBe(
      'gemini-4-carbon-medium',
    )
    expect(resolveModelWithTier('gemini-4-carbon-high').actualModel).toBe(
      'gemini-4-carbon-high',
    )
    expect(resolveModelWithTier('gemini-4-hydrogen').actualModel).toBe(
      'gemini-4-hydrogen-high',
    )
    expect(resolveModelWithTier('gemini-4-hydrogen-xhigh').actualModel).toBe(
      'gemini-4-hydrogen-xhigh',
    )
  })
})
