(() => {
  const { ui, api } = VoteSpace;
  const progress = current => `<div class="progress" aria-label="Voting progress">${['Select','Review','Complete'].map((s,i)=>`${i?'<span class="progress-line" aria-hidden="true"></span>':''}<div class="progress-item ${i===current?'active':i<current?'done':''}" ${i===current?'aria-current="step"':''}><span>${i<current?'✓':i+1}</span>${s}</div>`).join('')}</div>`;
  VoteSpace.pages.ballot = async id => {
    const pageHash = location.hash;
    const e = await api.election(id), existing = await api.participation(id);
    if(pageHash !== location.hash) return;
    if(existing) return VoteSpace.pages.acknowledgement(id);
    if(e.status !== 'open') return VoteSpace.pages.detail(id);
    let selection = null;
    const renderSelection = () => {
      VoteSpace.render(ui.breadcrumb([['Elections','#/elections'],[e.title,'#/election/'+id],['Your ballot']]) + `<section class="ballot-wrap">${progress(0)}<div class="ballot-heading"><div class="eyebrow">${ui.esc(e.title)}</div><h1>Who will you choose?</h1><p>Read the manifestos, then select the candidate who represents your vision.</p></div><fieldset class="ballot-options"><legend class="sr-only">Choose one candidate for ${ui.esc(e.title)}</legend><div class="candidate-grid">${e.candidates.map(c=>`<label class="panel candidate-card">${ui.avatar(c,true)}<span class="radio-check"><span class="selected-label">Selected</span><input type="radio" name="candidate" value="${ui.esc(c.id)}" aria-label="${ui.esc(c.name)}" ${selection===c.id?'checked':''}></span><h3>${ui.esc(c.name)}</h3><span class="candidate-detail">${ui.esc(c.detail)}</span><span class="manifesto">${ui.esc(c.manifesto)}</span><span class="candidate-footer">ONE CANDIDATE · ONE CHOICE</span></label>`).join('')}</div></fieldset><div class="ballot-actions">${ui.button('Back to election','#/election/'+id,'secondary','back')}<p>${ui.icon('info')}Your vote is final once submitted.</p><button class="btn" id="review-vote" ${selection?'':'disabled'}>Review my choice ${ui.icon('arrow')}</button></div></section>`,'elections');
      document.querySelectorAll('[name=candidate]').forEach(input=>input.onchange=()=>{selection=input.value;document.getElementById('review-vote').disabled=false;});
      document.getElementById('review-vote').onclick=renderReview;
    };
    const renderReview = () => {
      const c = e.candidates.find(c=>c.id===selection); if(!c) return;
      VoteSpace.render(ui.breadcrumb([['Elections','#/elections'],[e.title,'#/election/'+id],['Review ballot']]) + `<section class="ballot-wrap">${progress(1)}<div class="ballot-heading"><div class="eyebrow">ONE LAST LOOK</div><h1>Ready to make it count?</h1><p>Take a moment to check your choice before you submit.</p></div><div class="panel review-panel"><div class="eyebrow">YOUR SELECTION FOR ${ui.esc(e.title)}</div><div class="review-candidate">${ui.avatar(c,true)}<div><h3>${ui.esc(c.name)}</h3><p>${ui.esc(c.detail)}</p></div></div>${ui.banner('<strong>Your choice is final.</strong> Once submitted, your vote cannot be changed or withdrawn.','warning','info')}<div class="form-error" role="alert" id="vote-error"></div><div class="row between wrap"><button class="btn secondary" id="back-selection">${ui.icon('back')}Back to selection</button><button class="btn" id="submit-vote">Submit my vote ${ui.icon('check')}</button></div><p class="small muted" style="font-size:10px;margin-top:22px;text-align:center">Local demo · This ballot is saved in this browser.</p></div></section>`,'elections');
      document.getElementById('back-selection').onclick=renderSelection;
      document.getElementById('submit-vote').onclick=async event=>{
        const b=event.currentTarget, back=document.getElementById('back-selection'); b.disabled=true;back.disabled=true;b.innerHTML=ui.icon('spinner','spin')+'Recording your vote…';
        try{await api.vote(id,selection);VoteSpace.go('/acknowledgement/'+id);}
        catch(err){
          let confirmed=null,checked=false;try{confirmed=await api.participation(id);checked=true;}catch{/* Resolve status after signing in. */}
          if(confirmed) return VoteSpace.go('/acknowledgement/'+id);
          const error=document.getElementById('vote-error'); if(!error)return;
          error.textContent=err.message+(checked?' Your participation was checked; no recorded vote was found in this demo.':' Your submission status could not be confirmed. Check My ballots before trying again.');
          back.disabled=false;b.disabled=!checked;b.textContent=checked?'Try submission again':'Status not confirmed';
          if(!api.user()){b.disabled=true;error.innerHTML=ui.esc(err.message)+' <a href="#/login">Sign in to check your participation.</a>';}
        }
      };
    };
    renderSelection();
  };
  VoteSpace.pages.acknowledgement=async id=>{
    const pageHash = location.hash;
    const e=await api.election(id),receipt=await api.participation(id);
    if(pageHash !== location.hash) return;
    if(!receipt)return VoteSpace.pages.detail(id);
    VoteSpace.render(`<div class="ballot-wrap">${progress(2)}<section class="success-page"><div class="success-mark">${ui.icon('check')}</div><div class="eyebrow" style="margin-bottom:12px">THANK YOU FOR TAKING PART</div><h1>Your vote has been recorded.</h1><p>Your voice is part of what comes next.<br>You can view the results after the election closes.</p><div class="panel receipt"><div class="eyebrow">PARTICIPATION ACKNOWLEDGEMENT</div><div class="row between"><span class="muted">Election</span><strong>${ui.esc(e.title)}</strong></div><div class="row between"><span class="muted">Reference</span><code>${ui.esc(receipt.id)}</code></div><div class="row between"><span class="muted">Recorded</span><span>${ui.date(receipt.at)} · ${new Date(receipt.at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</span></div></div>${ui.button('Back to my dashboard','#/dashboard','','arrow')}<p class="small muted" style="margin-top:20px;font-size:10px">Local demo acknowledgement · Saved on this browser only.<br>This reference confirms demo participation; it is not a cryptographic receipt.</p></section></div>`,'ballots');
  };
})();
