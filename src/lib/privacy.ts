import type { PrivacyCheck } from './types';

// 简单隐私检测规则（用于分享/历史保存时的“隐藏提问”判断）
// - 长度 > 30：隐藏（避免包含过多可识别信息）
// - 正则命中：姓名/邮箱/手机号/身份证/学号/地址等
const RE_EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const RE_PHONE_CN = /(\+?86[-\s]?)?1[3-9]\d{9}/;
const RE_PHONE_LANDLINE = /\b0\d{2,3}-?\d{7,8}\b/;
const RE_ID_CN = /\b\d{17}[\dXx]\b/;
const RE_STUDENT_ID = /(学号|student\s*id)[：:\s]*\d{5,20}/i;
const RE_NAME_HINT = /(我叫|姓名|名字)[：:\s]*[\u4e00-\u9fa5]{2,4}/;
const RE_ADDRESS_HINT =
  /(\d{1,4}(号|室|栋|楼)|省|市|区|县|路|街|道|巷|弄|小区|公寓|单元|门牌)/;

export function checkPrivacy(text: string): PrivacyCheck {
  const t = (text ?? '').trim();
  const reasons: string[] = [];

  if (!t) return { shouldHide: false, reasons };
  if (t.length > 30) reasons.push('提问长度 > 30');
  if (RE_EMAIL.test(t)) reasons.push('疑似邮箱');
  if (RE_PHONE_CN.test(t) || RE_PHONE_LANDLINE.test(t)) reasons.push('疑似电话');
  if (RE_ID_CN.test(t)) reasons.push('疑似身份证号');
  if (RE_STUDENT_ID.test(t)) reasons.push('疑似学号');
  if (RE_NAME_HINT.test(t)) reasons.push('疑似姓名');
  if (RE_ADDRESS_HINT.test(t)) reasons.push('疑似地址/门牌');

  return { shouldHide: reasons.length > 0, reasons };
}

export function maskQuestion(question: string): { masked: string; hidden: boolean; reasons: string[] } {
  const check = checkPrivacy(question);
  if (check.shouldHide) {
    return { masked: '用户提问：已隐藏（隐私保护）', hidden: true, reasons: check.reasons };
  }
  return { masked: question.trim() || '（未填写）', hidden: false, reasons: [] };
}

// 用于发送给大模型前的轻量脱敏：尽量保留语义，但替换明确的个人隐私字段
export function sanitizeQuestionForLLM(question: string): { text: string; redacted: boolean; redactions: string[] } {
  let t = (question ?? '').trim();
  const redactions: string[] = [];

  if (!t) return { text: t, redacted: false, redactions };

  const replaceOnce = (re: RegExp, label: string, placeholder: string) => {
    if (re.test(t)) {
      redactions.push(label);
      t = t.replace(re, placeholder);
    }
  };

  replaceOnce(RE_EMAIL, '邮箱', '<邮箱>');
  // 电话可能出现多次，做全局替换
  if (RE_PHONE_CN.test(t) || RE_PHONE_LANDLINE.test(t)) {
    redactions.push('电话');
    t = t.replace(new RegExp(RE_PHONE_CN.source, 'g'), '<电话>');
    t = t.replace(new RegExp(RE_PHONE_LANDLINE.source, 'g'), '<电话>');
  }
  replaceOnce(RE_ID_CN, '身份证号', '<身份证号>');
  if (RE_STUDENT_ID.test(t)) {
    redactions.push('学号');
    t = t.replace(new RegExp(RE_STUDENT_ID.source, 'g'), (m) => m.replace(/\d{5,20}/g, '<学号>'));
  }
  if (RE_NAME_HINT.test(t)) {
    redactions.push('姓名');
    t = t.replace(new RegExp(RE_NAME_HINT.source, 'g'), (m) => m.replace(/[\u4e00-\u9fa5]{2,4}/g, '<姓名>'));
  }
  if (RE_ADDRESS_HINT.test(t)) {
    redactions.push('地址');
    t = t.replace(new RegExp(RE_ADDRESS_HINT.source, 'g'), '<地址片段>');
  }

  const uniq = Array.from(new Set(redactions));
  return { text: t, redacted: uniq.length > 0, redactions: uniq };
}

export const privacyRulesText = [
  '隐藏条件：提问长度 > 30 字',
  '或命中正则：邮箱 / 电话 / 身份证 / 学号 / “我叫/姓名/名字+2~4字” / 地址关键词'
].join('；');
