import type { StudyLesson, StudyQuestionType } from '../../types';
import { isStudyQuestionType } from './studyLibrary';

export function classifyImportedQuestion(raw: {
    type?: unknown; choices?: unknown; statements?: unknown;
}): { type?: StudyQuestionType; issue?: string } {
    const rawType = typeof raw.type === 'string' ? raw.type.trim().toLowerCase() : '';
    const type = rawType === 'multiple_choice' ? 'trac_nghiem'
        : rawType === 'true_false' ? 'dung_sai'
        : rawType === 'short_answer' ? 'tu_luan'
        : isStudyQuestionType(rawType) ? rawType : undefined;
    const choices = Array.isArray(raw.choices) ? raw.choices : [];
    const choiceCount = choices.filter(choice => String(choice ?? '').trim()).length;
    const statementCount = Array.isArray(raw.statements)
        ? raw.statements.filter(statement => typeof statement?.claim === 'string' && statement.claim.trim()).length
        : 0;
    if ((choiceCount && statementCount) || (type && ((choiceCount && type !== 'trac_nghiem')
        || (statementCount && type !== 'dung_sai')))) {
        return { issue: 'Loại câu và dữ liệu phương án hoặc mệnh đề đang mâu thuẫn.' };
    }
    if (type === 'trac_nghiem' || choiceCount) {
        return choiceCount === 4 && choices.slice(0, 4).every(choice => String(choice ?? '').trim())
            ? { type: 'trac_nghiem' } : { issue: 'Câu trắc nghiệm cần đủ bốn phương án.' };
    }
    if (type === 'dung_sai' || statementCount) {
        return statementCount === 4 ? { type: 'dung_sai' } : { issue: 'Câu Đúng/Sai cần đủ bốn mệnh đề.' };
    }
    return type ? { type } : { issue: 'JSON chưa có đủ thông tin để xác định loại câu.' };
}

export function matchingStudyImportLessons(lessons: StudyLesson[], source: StudyLesson, type: StudyQuestionType) {
    if (type === source.studySection.questionType) return [source];
    const normalize = (title: string) => title.trim().replace(/\s+/g, ' ').normalize('NFC').toLocaleLowerCase('vi');
    const title = normalize(source.title);
    return lessons.filter(lesson => lesson.studySection.chapterId === source.studySection.chapterId
        && lesson.studySection.questionType === type && normalize(lesson.title) === title);
}
