import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, errMsg } from "../lib/api";
import type { Exam, ExamInput } from "../lib/types";
import { Button, Field, Input, Modal, Select, Textarea } from "./ui";

const EMPTY: ExamInput = {
  name: "",
  subject: "",
  exam_date: new Date().toISOString().slice(0, 10),
  description: "",
  num_questions: 40,
  num_options: 4,
  max_score: 10,
  pass_score: 5,
};

export function ExamFormModal({ open, onClose, exam, onSaved }: { open: boolean; onClose: () => void; exam?: Exam; onSaved?: (e: Exam) => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<ExamInput>(EMPTY);
  useEffect(() => {
    if (open) setForm(exam ? { ...EMPTY, ...exam } : EMPTY);
  }, [open, exam]);
  const set = <K extends keyof ExamInput>(k: K, v: ExamInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const locked = !!exam && exam.num_submissions > 0;

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name,
        subject: form.subject,
        exam_date: form.exam_date,
        description: form.description,
        num_questions: form.num_questions,
        num_options: form.num_options,
        max_score: form.max_score,
        pass_score: form.pass_score,
      };
      return exam ? api.put<Exam>(`/api/exams/${exam.id}`, body) : api.post<Exam>("/api/exams", body);
    },
    onSuccess: (e) => {
      qc.invalidateQueries({ queryKey: ["exams"] });
      qc.invalidateQueries({ queryKey: ["exam", e.id] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(exam ? "Đã cập nhật kỳ thi" : "Đã tạo kỳ thi");
      onClose();
      onSaved?.(e);
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={exam ? "Sửa thông tin kỳ thi" : "Tạo kỳ thi mới"}
      description={exam ? undefined : "Thông tin này được in lên phiếu trả lời."}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!form.name.trim()}>
            {exam ? "Lưu thay đổi" : "Tạo kỳ thi"}
          </Button>
        </>
      }
    >
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <Field label="Tên kỳ thi *" className="sm:col-span-2">
          <Input autoFocus value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="VD: Kiểm tra giữa kỳ I" />
        </Field>
        <Field label="Môn thi">
          <Input value={form.subject} onChange={(e) => set("subject", e.target.value)} placeholder="VD: Toán 12" />
        </Field>
        <Field label="Ngày thi">
          <Input type="date" value={form.exam_date} onChange={(e) => set("exam_date", e.target.value)} />
        </Field>
        <Field label="Số câu hỏi" hint={locked ? "Không thể đổi khi đã có bài làm" : "Tối đa 120 câu"}>
          <Input type="number" min={1} max={120} disabled={locked} value={form.num_questions}
            onChange={(e) => set("num_questions", Math.max(1, Math.min(120, Number(e.target.value) || 1)))} />
        </Field>
        <Field label="Số phương án mỗi câu">
          <Select disabled={locked} value={form.num_options} onChange={(e) => set("num_options", Number(e.target.value))}>
            {[2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n} ({"ABCDEF".slice(0, n).split("").join(", ")})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Thang điểm">
          <Input type="number" min={1} step={0.5} value={form.max_score} onChange={(e) => set("max_score", Number(e.target.value) || 10)} />
        </Field>
        <Field label="Điểm đạt">
          <Input type="number" min={0} step={0.5} value={form.pass_score} onChange={(e) => set("pass_score", Number(e.target.value) || 0)} />
        </Field>
        <Field label="Ghi chú" className="sm:col-span-2">
          <Textarea rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} />
        </Field>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}
