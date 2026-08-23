using System;

public static class AutomaticYouTubePolicy
{
    public const int MaxReadinessAttempts = 5;

    public static bool HasExplicitTitleTemplate(string template)
    {
        return !string.IsNullOrWhiteSpace(template);
    }

    public static T RunWhenReady<T>(Func<bool> isReady, Action wait, Func<T> apply)
    {
        if (isReady == null) throw new ArgumentNullException("isReady");
        if (wait == null) throw new ArgumentNullException("wait");
        if (apply == null) throw new ArgumentNullException("apply");

        Exception lastReadinessError = null;
        for (int attempt = 1; attempt <= MaxReadinessAttempts; attempt++)
        {
            bool ready = false;
            try
            {
                ready = isReady();
            }
            catch (Exception ex)
            {
                lastReadinessError = ex;
            }

            // Applying metadata is deliberately outside the readiness catch:
            // a partial platform failure must propagate without another write.
            if (ready)
                return apply();

            if (attempt < MaxReadinessAttempts)
                wait();
        }

        string detail = lastReadinessError == null ? "эфир не перешёл в состояние live." : lastReadinessError.Message;
        throw new InvalidOperationException("YouTube-эфир не готов для автоматического применения параметров: " + detail);
    }
}
