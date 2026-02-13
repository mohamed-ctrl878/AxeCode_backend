"use strict";

/**
 * code-template controller
 */

const { createCoreController } = require("@strapi/strapi").factories;
const {
  generateStarterCode,
  generateWrapperCode,
  LANGUAGE_IDS,
} = require("../services/code-template");

module.exports = createCoreController(
  "api::code-template.code-template",
  ({ strapi }) => ({
    /**
     * Generate code templates for a problem
     * POST /api/code-templates/generate/:problemId
     */
    async generate(ctx) {
      const { problemId } = ctx.params;
      const { language } = ctx.request.body || {};

      if (!problemId) {
        return ctx.badRequest("Problem ID is required");
      }

      // Fetch the problem
      const problem = await strapi.documents("api::problem.problem").findOne({
        documentId: problemId,
        populate: ["code_templates"],
      });

      if (!problem) {
        return ctx.notFound("Problem not found");
      }

      const { functionName, functionParams, returnType } = problem;

      if (!functionName) {
        return ctx.badRequest("Problem must have a functionName defined");
      }

      // Generate for specific language or all languages
      const languages = language ? [language] : Object.keys(LANGUAGE_IDS);
      const results = [];

      for (const lang of languages) {
        if (!LANGUAGE_IDS[lang]) {
          continue;
        }

        try {
          const starterCode = generateStarterCode(
            lang,
            functionName,
            functionParams,
            returnType
          );
          const wrapperCode = generateWrapperCode(
            lang,
            functionName,
            functionParams,
            returnType
          );

          // Check if template already exists for this language
          const existingTemplate = problem.code_templates?.find(
            (t) => t.language === lang
          );

          let template;
          if (existingTemplate) {
            // Update existing template
            template = await strapi
              .documents("api::code-template.code-template")
              .update({
                documentId: existingTemplate.documentId,
                data: {
                  starterCode,
                  wrapperCode,
                },
              });
          } else {
            // Create new template
            template = await strapi
              .documents("api::code-template.code-template")
              .create({
                data: {
                  language: lang,
                  starterCode,
                  wrapperCode,
                  problem: problemId,
                },
              });
          }

          results.push({
            language: lang,
            languageId: LANGUAGE_IDS[lang],
            template,
          });
        } catch (error) {
          results.push({
            language: lang,
            error: error.message,
          });
        }
      }

      return {
        data: results,
        meta: {
          problemId,
          functionName,
          generatedAt: new Date().toISOString(),
        },
      };
    },

    /**
     * Get starter code for a specific language
     * GET /api/code-templates/starter/:problemId/:language
     */
    async getStarterCode(ctx) {
      const { problemId, language } = ctx.params;

      if (!LANGUAGE_IDS[language]) {
        return ctx.badRequest(
          `Unsupported language: ${language}. Supported: ${Object.keys(LANGUAGE_IDS).join(", ")}`
        );
      }

      const problem = await strapi.documents("api::problem.problem").findOne({
        documentId: problemId,
        populate: {
          code_templates: {
            filters: { language: { $eq: language } },
          },
        },
      });

      if (!problem) {
        return ctx.notFound("Problem not found");
      }

      // Return existing template or generate on-the-fly
      if (problem.code_templates?.length > 0) {
        return {
          data: {
            language,
            languageId: LANGUAGE_IDS[language],
            starterCode: problem.code_templates[0].starterCode,
            cached: true,
          },
        };
      }

      // Generate on-the-fly
      const starterCode = generateStarterCode(
        language,
        problem.functionName,
        problem.functionParams,
        problem.returnType
      );

      return {
        data: {
          language,
          languageId: LANGUAGE_IDS[language],
          starterCode,
          cached: false,
        },
      };
    },
  })
);
